import prisma from '../../lib/prisma';

const { createNotification } = require('../notification/notification.service');

export interface CreateEscrowHoldInput {
  order_id: string;
  vendor_id: string;
  amount: number;
}

/**
 * Create an escrow hold when buyer pays
 * This holds the funds until delivery is confirmed or auto-release timer expires
 */
export async function createEscrowHold(input: CreateEscrowHoldInput) {
  // Create wallet transaction for escrow hold
  const walletTransaction = await prisma.walletTransaction.create({
    data: {
      vendor_id: input.vendor_id,
      order_id: input.order_id,
      amount: input.amount,
      tx_type: 'escrow_hold',
      status: 'pending',
      notes: 'Payment held in escrow pending delivery confirmation',
    },
  });

  // Update order escrow status
  const autoReleaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
  
  await prisma.order.update({
    where: { id: input.order_id },
    data: {
      escrow_status: 'held',
      auto_release_at: autoReleaseAt,
    },
  });

  return walletTransaction;
}

/**
 * Release escrow to vendor wallet after delivery confirmation
 */
export async function releaseEscrow(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'Order is not in escrow' };
  }

  // Find the escrow hold transaction
  const escrowHold = await prisma.walletTransaction.findFirst({
    where: {
      order_id: orderId,
      tx_type: 'escrow_hold',
      status: 'pending',
    },
  });

  if (!escrowHold) {
    throw { statusCode: 404, message: 'Escrow hold transaction not found' };
  }

  // Update escrow hold transaction to completed
  await prisma.walletTransaction.update({
    where: { id: escrowHold.id },
    data: { status: 'completed' },
  });

  // Create escrow release transaction
  const releaseTransaction = await prisma.walletTransaction.create({
    data: {
      vendor_id: order.vendor_id,
      order_id: orderId,
      amount: escrowHold.amount,
      tx_type: 'escrow_release',
      status: 'completed',
      notes: 'Escrow released to vendor after delivery confirmation',
    },
  });

  // Credit vendor's wallet
  const vendorWallet = await prisma.wallet.findUnique({
    where: { user_id: order.vendor.user_id },
  });

  if (vendorWallet) {
    await prisma.wallet.update({
      where: { user_id: order.vendor.user_id },
      data: {
        available_balance: {
          increment: escrowHold.amount,
        },
      },
    });
  }

  // Update order escrow status
  await prisma.order.update({
    where: { id: orderId },
    data: {
      escrow_status: 'released',
      delivery_confirmed_at: new Date(),
      status: 'completed',
    },
  });

  // Update vendor's payment_received transaction status to success
  await prisma.transaction.updateMany({
    where: {
      user_id: order.vendor.user_id,
      counterparty_id: order.buyer_id,
      type: 'payment_received',
      status: 'pending',
    },
    data: {
      status: 'success',
    },
  });

  // Notify vendor
  try {
    await createNotification({
      userId: order.vendor.user_id,
      type: 'escrow_released',
      title: 'Payment Released',
      body: `₦${escrowHold.amount} has been released to your wallet`,
      data: { order_id: orderId, amount: escrowHold.amount },
    });
  } catch (notifError) {
    console.error('[Escrow] Notification error:', notifError);
  }

  return releaseTransaction;
}

/**
 * Auto-release escrow for orders past the 5-day window with no disputes
 * This should be run by a cron job
 */
export async function autoReleaseEscrow() {
  const now = new Date();
  
  // Find orders where escrow is held and auto_release_at has passed
  const ordersToRelease = await prisma.order.findMany({
    where: {
      escrow_status: 'held',
      auto_release_at: {
        lte: now,
      },
      status: {
        not: 'disputed',
      },
    },
    include: { vendor: true },
  });

  const releasedOrders = [];

  for (const order of ordersToRelease) {
    try {
      await releaseEscrow(order.id);
      releasedOrders.push(order.id);
    } catch (error) {
      console.error(`[Escrow] Auto-release failed for order ${order.id}:`, error);
    }
  }

  return {
    released_count: releasedOrders.length,
    released_orders: releasedOrders,
  };
}

/**
 * Refund escrow to buyer (for disputed orders)
 */
export async function refundEscrow(orderId: string, reason?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'Order is not in escrow' };
  }

  // Find the escrow hold transaction
  const escrowHold = await prisma.walletTransaction.findFirst({
    where: {
      order_id: orderId,
      tx_type: 'escrow_hold',
      status: 'pending',
    },
  });

  if (!escrowHold) {
    throw { statusCode: 404, message: 'Escrow hold transaction not found' };
  }

  // Update escrow hold transaction
  await prisma.walletTransaction.update({
    where: { id: escrowHold.id },
    data: {
      status: 'completed',
      notes: reason || 'Escrow refunded to buyer due to dispute',
    },
  });

  // Create refund transaction
  const refundTransaction = await prisma.walletTransaction.create({
    data: {
      vendor_id: order.vendor_id,
      order_id: orderId,
      amount: escrowHold.amount,
      tx_type: 'refund',
      status: 'completed',
      notes: reason || 'Refunded to buyer',
    },
  });

  // Credit buyer's wallet (refund)
  const buyerWallet = await prisma.wallet.findUnique({
    where: { user_id: order.buyer_id },
  });

  if (buyerWallet) {
    await prisma.wallet.update({
      where: { user_id: order.buyer_id },
      data: {
        available_balance: {
          increment: escrowHold.amount,
        },
      },
    });
  }

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: {
      escrow_status: 'refunded',
      status: 'refunded',
    },
  });

  // Notify buyer
  try {
    await createNotification({
      userId: order.buyer_id,
      type: 'refund_processed',
      title: 'Refund Processed',
      body: `₦${escrowHold.amount} has been refunded to your wallet`,
      data: { order_id: orderId, amount: escrowHold.amount },
    });
  } catch (notifError) {
    console.error('[Escrow] Notification error:', notifError);
  }

  return refundTransaction;
}

/**
 * Get escrow status for an order
 */
export async function getEscrowStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      escrow_status: true,
      auto_release_at: true,
      delivery_confirmed_at: true,
      amount: true,
    },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: 'desc' },
  });

  return {
    order,
    transactions,
  };
}

/**
 * Confirm delivery (buyer action)
 */
export async function confirmDelivery(orderId: string, buyerId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  if (order.buyer_id !== buyerId) {
    throw { statusCode: 403, message: 'Access denied' };
  }

  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'Order is not in escrow' };
  }

  // Release escrow
  return await releaseEscrow(orderId);
}
