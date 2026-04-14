import prisma from '../../lib/prisma'

// Notification service
const { createNotification } = require('../notification/notification.service')

// Escrow service
const { createEscrowHold } = require('../escrow/escrow.service')

/**
 * Get user's wallet balance
 */
export async function getWalletBalance(userId: string): Promise<{ available_balance: number; frozen_balance: number; currency: string }> {
  const wallet = await prisma.wallet.findUnique({
    where: { user_id: userId },
  })

  if (!wallet) {
    // Create wallet if doesn't exist
    const newWallet = await prisma.wallet.create({
      data: {
        user_id: userId,
        available_balance: 0,
        frozen_balance: 0,
        currency: 'NGN',
      },
    })
    return {
      available_balance: newWallet.available_balance,
      frozen_balance: newWallet.frozen_balance,
      currency: newWallet.currency,
    }
  }

  return {
    available_balance: wallet.available_balance,
    frozen_balance: wallet.frozen_balance,
    currency: wallet.currency,
  }
}

/**
 * Process payment from buyer to vendor
 * This creates a transaction, updates wallet balances, and marks payment request as paid
 */
export async function processPayment(
  buyerId: string,
  vendorId: string,
  amount: number,
  paymentRequestId: string,
  description?: string
): Promise<{ success: boolean; message: string }> {
  console.log('[Wallet] Processing payment:', { buyerId, vendorId, amount, paymentRequestId });

  // Validate amount
  if (amount <= 0) {
    throw { statusCode: 400, message: 'Invalid amount' }
  }

  // Get buyer and vendor wallets
  const [buyerWallet, vendorWallet] = await Promise.all([
    prisma.wallet.findUnique({ where: { user_id: buyerId } }),
    prisma.wallet.findUnique({ where: { user_id: vendorId } }),
  ])

  if (!buyerWallet) {
    throw { statusCode: 404, message: 'Buyer wallet not found' }
  }
  if (!vendorWallet) {
    throw { statusCode: 404, message: 'Vendor wallet not found' }
  }

  // Check sufficient balance
  if (buyerWallet.available_balance < amount) {
    throw { statusCode: 400, message: 'Insufficient balance' }
  }

  console.log('[Wallet] Wallets validated, proceeding with transaction');

  // Start transaction (using Prisma's transaction)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct from buyer
      await tx.wallet.update({
        where: { user_id: buyerId },
        data: { available_balance: { decrement: amount } },
      })

      // 2. Create transaction record for buyer
      await tx.transaction.create({
        data: {
          user_id: buyerId,
          type: 'payment_sent',
          amount,
          status: 'success',
          reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: description || 'Payment to vendor (held in escrow)',
          counterparty_id: vendorId,
          provider: 'monnify',
        },
      })

      // 3. Create transaction record for vendor (pending until escrow release)
      await tx.transaction.create({
        data: {
          user_id: vendorId,
          type: 'payment_received',
          amount,
          status: 'pending',
          reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: description || 'Payment from buyer (held in escrow)',
          counterparty_id: buyerId,
          provider: 'monnify',
        },
      })

      // 4. Update payment request status if ID provided and create Order record with escrow
      let orderId: string | null = null;
      if (paymentRequestId) {
        const paymentRequest = await tx.paymentRequest.findUnique({
          where: { id: paymentRequestId },
        });

        if (paymentRequest) {
          await tx.paymentRequest.update({
            where: { id: paymentRequestId },
            data: { status: 'paid', paid_at: new Date() },
          });

          // Create Order record with escrow status
          const order = await tx.order.create({
            data: {
              buyer_id: buyerId,
              vendor_id: paymentRequest.vendor_id,
              vendor_user_id: vendorId,
              payment_request_id: paymentRequestId,
              conversation_id: paymentRequest.conversation_id,
              amount: paymentRequest.amount,
              description: paymentRequest.description,
              status: 'pending',
              escrow_status: 'held',
              auto_release_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
            },
          });
          orderId = order.id;
          console.log('[Wallet] Order created with escrow:', order.id, 'for buyer:', buyerId, 'vendor:', vendorId);

          // Create escrow hold transaction
          await tx.walletTransaction.create({
            data: {
              vendor_id: paymentRequest.vendor_id,
              order_id: order.id,
              amount: paymentRequest.amount,
              tx_type: 'escrow_hold',
              status: 'pending',
              notes: 'Payment held in escrow pending delivery confirmation',
            },
          });
        } else {
          console.log('[Wallet] Payment request not found for order creation:', paymentRequestId);
        }
      }

      return { orderId };
    });

    console.log('[Wallet] Payment transaction completed successfully with escrow');

    // Send notifications outside transaction (after commit)
    if (paymentRequestId) {
      try {
        await createNotification({
          userId: buyerId,
          type: 'order_placed',
          title: 'Order placed successfully',
          body: `Your order of ₦${amount.toLocaleString()} has been placed. Payment held in escrow until delivery.`,
          data: { order_id: result.orderId, conversation_id: null },
        })
      } catch (notifError) {
        console.error('[Wallet] Notification error for order_placed:', notifError)
      }

      try {
        await createNotification({
          userId: vendorId,
          type: 'new_order',
          title: 'New order received',
          body: `New order of ₦${amount.toLocaleString()} received. Payment will be released after delivery confirmation.`,
          data: { order_id: result.orderId, conversation_id: null },
        })
      } catch (notifError) {
        console.error('[Wallet] Notification error for new_order:', notifError)
      }
    }

    return { success: true, message: 'Payment processed and held in escrow' }
  } catch (err: any) {
    console.error('[Wallet] Payment transaction failed:', err);
    throw err;
  }
}
