import prisma from '../../lib/prisma';
import { refundEscrow, releaseEscrow } from '../escrow/escrow.service';

const { createNotification } = require('../notification/notification.service');

export interface CreateDisputeInput {
  orderId: string;
  userId: string;
  reason: string;
  description?: string;
  evidence_urls?: string[];
}

/**
 * Open a dispute — funds stay in escrow until admin resolves (no instant refund).
 */
export async function createDispute(
  input: CreateDisputeInput
): Promise<{ success: boolean; message: string; disputeId?: string }> {
  const { orderId, userId, reason, description, evidence_urls = [] } = input;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendor: { select: { user_id: true, shop_name: true } },
    },
  });

  if (!order) throw { statusCode: 404, message: 'Order not found' };
  if (order.buyer_id !== userId) {
    throw { statusCode: 403, message: 'Only the buyer can create a dispute' };
  }
  if (order.escrow_status !== 'held') {
    throw {
      statusCode: 400,
      message: 'This order cannot be disputed (escrow already released or refunded)',
    };
  }

  const existingDispute = await prisma.dispute.findFirst({
    where: { order_id: orderId, status: 'open' },
  });
  if (existingDispute) {
    throw { statusCode: 400, message: 'A dispute already exists for this order' };
  }

  // Delivery + OTP confirmed: require evidence and detailed description
  if (order.order_type === 'delivery' && order.otp_confirmed) {
    const desc = (description ?? '').trim();
    if (desc.length < 20) {
      throw {
        statusCode: 400,
        message:
          'Please provide a detailed explanation (at least 20 characters). Delivery was verified with your code.',
      };
    }
    if (!evidence_urls.length) {
      throw {
        statusCode: 400,
        message: 'Photo evidence is required when disputing after delivery code was used.',
      };
    }
  }

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        order_id: orderId,
        buyer_id: userId,
        vendor_id: order.vendor_id,
        reason,
        description: description?.trim() || null,
        evidence_urls: evidence_urls,
        status: 'open',
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        escrow_status: 'disputed',
        status: 'disputed',
      },
    });

    return created;
  });

  try {
    await createNotification({
      userId: order.vendor.user_id,
      type: 'order_disputed',
      title: 'Order disputed',
      body: `A buyer opened a dispute for order ₦${order.amount.toLocaleString()}. Our team will review it.`,
      data: { order_id: orderId, dispute_id: dispute.id },
    });
  } catch (e) {
    console.error('[Dispute] Vendor notification error:', e);
  }

  return {
    success: true,
    message: 'Dispute submitted. Our team will review it. Funds remain in escrow until resolved.',
    disputeId: dispute.id,
  };
}

/**
 * Resolve a dispute (admin): refund buyer or release to vendor.
 */
export async function resolveDispute(
  disputeId: string,
  resolution: 'refund_buyer' | 'release_vendor',
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      order: { include: { vendor: { select: { user_id: true } } } },
    },
  });

  if (!dispute) throw { statusCode: 404, message: 'Dispute not found' };
  if (dispute.status !== 'open') {
    throw { statusCode: 400, message: 'This dispute has already been resolved' };
  }

  // Fetch the order with escrow_status to check if it's releasable
  const order = await prisma.order.findUnique({
    where: { id: dispute.order_id },
    select: { escrow_status: true },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  // Check if escrow is in a state that allows release or refund
  const canRelease = order.escrow_status === 'held' || order.escrow_status === 'disputed';
  if (!canRelease) {
    throw {
      statusCode: 400,
      message: `Order escrow cannot be released or refunded — current status: ${order.escrow_status}. Funds may have already been disbursed.`,
    };
  }

  if (resolution === 'refund_buyer') {
    await refundEscrow(dispute.order_id, adminNotes || `Dispute resolved: refund buyer`);
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'resolved',
        resolution: 'refund_buyer',
        admin_notes: adminNotes,
        resolved_at: new Date(),
      },
    });
  } else if (resolution === 'release_vendor') {
    await releaseEscrow(dispute.order_id);
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'resolved',
        resolution: 'release_vendor',
        admin_notes: adminNotes,
        resolved_at: new Date(),
      },
    });
  }

  return { success: true, message: 'Dispute resolved successfully' };
}

export async function getAllDisputes(
  status?: 'open' | 'resolved',
  limit = 50,
  offset = 0
): Promise<any[]> {
  const where: Record<string, unknown> = {};
  if (status === 'open') where.status = 'open';
  if (status === 'resolved') where.status = { in: ['resolved', 'dismissed'] };

  const disputes = await prisma.dispute.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          amount: true,
          description: true,
          order_type: true,
          otp_confirmed: true,
          buyer_confirmed_at: true,
          created_at: true,
        },
      },
      buyer: { select: { id: true, full_name: true, email: true } },
      vendor: { select: { id: true, shop_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });

  return disputes.map((d) => ({
    id: d.id,
    order_id: d.order_id,
    order: d.order,
    buyer: d.buyer,
    vendor: d.vendor,
    reason: d.reason,
    description: d.description,
    evidence_urls: d.evidence_urls ?? [],
    status: d.status,
    resolution: d.resolution,
    admin_notes: d.admin_notes,
    created_at: d.created_at.toISOString(),
    resolved_at: d.resolved_at?.toISOString() || null,
  }));
}

export async function getUserDisputes(userId: string): Promise<any[]> {
  const disputes = await prisma.dispute.findMany({
    where: {
      OR: [{ buyer_id: userId }, { vendor: { user_id: userId } }],
    },
    include: {
      order: {
        select: {
          id: true,
          amount: true,
          description: true,
          order_type: true,
          created_at: true,
        },
      },
      vendor: { select: { id: true, shop_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return disputes.map((d) => ({
    id: d.id,
    order_id: d.order_id,
    order: d.order,
    vendor: d.vendor,
    reason: d.reason,
    description: d.description,
    evidence_urls: d.evidence_urls ?? [],
    status: d.status,
    resolution: d.resolution,
    created_at: d.created_at.toISOString(),
    resolved_at: d.resolved_at?.toISOString() || null,
  }));
}
