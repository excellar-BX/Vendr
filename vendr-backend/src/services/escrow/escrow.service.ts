import prisma from '../../lib/prisma';
import { escrowHoldReleaseAt, pickupFallbackReleaseAt } from '../../lib/otp';

const { createNotification } = require('../notification/notification.service');

export interface CreateEscrowHoldInput {
  order_id: string;
  vendor_id: string;
  amount: number;
}

function canReleaseEscrow(escrowStatus: string): boolean {
  return escrowStatus === 'held' || escrowStatus === 'disputed';
}

/**
 * Create an escrow hold when buyer pays
 */
export async function createEscrowHold(input: CreateEscrowHoldInput) {
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

  await prisma.order.update({
    where: { id: input.order_id },
    data: {
      escrow_status: 'held',
      auto_release_at: pickupFallbackReleaseAt(),
    },
  });

  return walletTransaction;
}

/**
 * Release escrow to vendor wallet
 */
export async function releaseEscrow(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  if (!canReleaseEscrow(order.escrow_status)) {
    throw { statusCode: 400, message: 'Order escrow cannot be released' };
  }

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

  await prisma.walletTransaction.update({
    where: { id: escrowHold.id },
    data: { status: 'completed' },
  });

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

  const vendorWallet = await prisma.wallet.findUnique({
    where: { user_id: order.vendor.user_id },
  });

  if (vendorWallet) {
    await prisma.wallet.update({
      where: { user_id: order.vendor.user_id },
      data: {
        available_balance: { increment: escrowHold.amount },
      },
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      escrow_status: 'released',
      delivery_confirmed_at: new Date(),
      status: 'completed',
    },
  });

  await prisma.transaction.updateMany({
    where: {
      user_id: order.vendor.user_id,
      counterparty_id: order.buyer_id,
      type: 'payment_received',
      status: 'pending',
    },
    data: { status: 'success' },
  });

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
 * Auto-release escrow (cron). Rules:
 * - Pickup: buyer confirmed + hold window passed, OR 5-day fallback without confirmation
 * - Delivery: OTP confirmed + hold window passed only (no auto-release without OTP)
 */
export async function autoReleaseEscrow() {
  const now = new Date();

  const candidates = await prisma.order.findMany({
    where: {
      escrow_status: 'held',
      status: { not: 'disputed' },
      auto_release_at: { lte: now },
    },
    include: { vendor: true },
  });

  const releasedOrders: string[] = [];

  for (const order of candidates) {
    // Delivery without OTP: never auto-release
    if (order.order_type === 'delivery' && !order.otp_confirmed) continue;

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
 * Refund escrow to buyer (admin dispute resolution or policy)
 */
export async function refundEscrow(orderId: string, reason?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  if (!canReleaseEscrow(order.escrow_status)) {
    throw { statusCode: 400, message: 'Order escrow cannot be refunded' };
  }

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

  await prisma.walletTransaction.update({
    where: { id: escrowHold.id },
    data: {
      status: 'completed',
      notes: reason || 'Escrow refunded to buyer',
    },
  });

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

  const buyerWallet = await prisma.wallet.findUnique({
    where: { user_id: order.buyer_id },
  });

  if (buyerWallet) {
    await prisma.wallet.update({
      where: { user_id: order.buyer_id },
      data: {
        available_balance: { increment: escrowHold.amount },
      },
    });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      escrow_status: 'refunded',
      status: 'refunded',
    },
  });

  await prisma.transaction.updateMany({
    where: {
      user_id: order.vendor.user_id,
      counterparty_id: order.buyer_id,
      type: 'payment_received',
      status: 'pending',
    },
    data: { status: 'failed' },
  });

  await prisma.transaction.create({
    data: {
      user_id: order.buyer_id,
      type: 'refund',
      amount: escrowHold.amount,
      status: 'success',
      reference: `REFUND-${orderId}`,
      description: reason || 'Escrow refund',
      counterparty_id: order.vendor.user_id,
      provider: 'vendr',
    },
  });

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

export async function getEscrowStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      escrow_status: true,
      auto_release_at: true,
      delivery_confirmed_at: true,
      buyer_confirmed_at: true,
      otp_confirmed: true,
      otp_confirmed_at: true,
      order_type: true,
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

  return { order, transactions };
}

/**
 * Pickup: buyer confirms receipt — stamps buyer_confirmed_at, then releases escrow immediately
 */
export async function confirmDelivery(orderId: string, buyerId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (order.buyer_id !== buyerId) throw { statusCode: 403, message: 'Access denied' };
  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'Order is not in escrow' };
  }
  if (order.order_type !== 'pickup') {
    throw { statusCode: 400, message: 'Use delivery code verification for delivery orders' };
  }
  if (order.buyer_confirmed_at) {
    throw { statusCode: 400, message: 'Receipt already confirmed' };
  }

  // Stamp confirmation time for audit trail before releasing
  await prisma.order.update({
    where: { id: orderId },
    data: { buyer_confirmed_at: new Date() },
  });

  // Release escrow immediately — vendor gets credited right away
  await releaseEscrow(orderId);

  return {
    success: true,
    message: 'Receipt confirmed. Payment has been released to the vendor.',
  };
}

/**
 * Delivery: vendor/rider enters OTP spoken by buyer at handoff
 */
export async function verifyDeliveryOtp(orderId: string, vendorUserId: string, code: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (order.vendor.user_id !== vendorUserId) {
    throw { statusCode: 403, message: 'Only the vendor can verify delivery' };
  }
  if (order.order_type !== 'delivery') {
    throw { statusCode: 400, message: 'OTP verification is only for delivery orders' };
  }
  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'Order is not in escrow' };
  }
  if (order.otp_confirmed) {
    throw { statusCode: 400, message: 'Delivery already verified' };
  }
  if (!order.otp_code || order.otp_code !== code.trim()) {
    throw { statusCode: 400, message: 'Invalid delivery code' };
  }

  const releaseAt = escrowHoldReleaseAt();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      otp_confirmed: true,
      otp_confirmed_at: new Date(),
      auto_release_at: releaseAt,
    },
  });

  return {
    success: true,
    message: 'Delivery verified. Payment will release after a short hold period.',
    auto_release_at: releaseAt.toISOString(),
  };
}

/**
 * Delivery: buyer fetches their OTP (never exposed to vendor APIs)
 */
export async function getDeliveryOtp(orderId: string, buyerId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyer_id: true,
      order_type: true,
      otp_code: true,
      otp_confirmed: true,
      escrow_status: true,
    },
  });

  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (order.buyer_id !== buyerId) throw { statusCode: 403, message: 'Access denied' };
  if (order.order_type !== 'delivery') {
    throw { statusCode: 400, message: 'Delivery code is only for delivery orders' };
  }
  if (!order.otp_code) {
    throw { statusCode: 400, message: 'No delivery code for this order' };
  }
  if (order.otp_confirmed) {
    throw { statusCode: 400, message: 'Delivery already completed' };
  }

  return { otp_code: order.otp_code };
}