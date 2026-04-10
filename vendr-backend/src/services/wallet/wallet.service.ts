import prisma from '../../lib/prisma'

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

      // 2. Credit vendor (available for withdrawal)
      await tx.wallet.update({
        where: { user_id: vendorId },
        data: { available_balance: { increment: amount } },
      })

      // 3. Create transaction records (both sides)
      await tx.transaction.createMany({
        data: [
          {
            user_id: buyerId,
            type: 'payment_sent',
            amount,
            status: 'success',
            reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: description || 'Payment to vendor',
            counterparty_id: vendorId,
            provider: 'monnify',
          },
          {
            user_id: vendorId,
            type: 'payment_received',
            amount,
            status: 'success',
            reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: description || 'Payment from buyer',
            counterparty_id: buyerId,
            provider: 'monnify',
          },
        ],
      })

      // 4. Update payment request status if ID provided and create Order record
      if (paymentRequestId) {
        const paymentRequest = await tx.paymentRequest.findUnique({
          where: { id: paymentRequestId },
        });

        if (paymentRequest) {
          await tx.paymentRequest.update({
            where: { id: paymentRequestId },
            data: { status: 'paid', paid_at: new Date() },
          });

          // Create Order record to track bought/sold counts
          // vendorId parameter is now vendor.user_id, so we use paymentRequest.vendor_id for the actual vendor ID
          const order = await tx.order.create({
            data: {
              buyer_id: buyerId,
              vendor_id: paymentRequest.vendor_id,
              vendor_user_id: vendorId, // This is the vendor's user_id
              payment_request_id: paymentRequestId,
              conversation_id: paymentRequest.conversation_id,
              amount: paymentRequest.amount,
              description: paymentRequest.description,
              status: 'completed',
            },
          });
          console.log('[Wallet] Order created:', order.id, 'for buyer:', buyerId, 'vendor:', vendorId);
        } else {
          console.log('[Wallet] Payment request not found for order creation:', paymentRequestId);
        }
      }
    })

    console.log('[Wallet] Payment transaction completed successfully');
    return { success: true, message: 'Payment processed successfully' }
  } catch (err: any) {
    console.error('[Wallet] Payment transaction failed:', err);
    throw err;
  }
}
