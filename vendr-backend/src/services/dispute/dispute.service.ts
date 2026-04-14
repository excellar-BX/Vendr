import prisma from '../../lib/prisma';

/**
 * Create a dispute for an order
 * This will refund the escrow to the buyer
 */
export async function createDispute(
  orderId: string,
  userId: string,
  reason: string,
  description?: string
): Promise<{ success: boolean; message: string; disputeId?: string }> {
  console.log('[Dispute] Creating dispute for order:', orderId, 'by user:', userId);

  // Get order with escrow status
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendor: {
        select: { user_id: true, shop_name: true },
      },
    },
  });

  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  // Check if user is the buyer
  if (order.buyer_id !== userId) {
    throw { statusCode: 403, message: 'Only the buyer can create a dispute' };
  }

  // Check if order is in escrow and can be disputed
  if (order.escrow_status !== 'held') {
    throw { statusCode: 400, message: 'This order cannot be disputed (escrow already released or refunded)' };
  }

  // Check if dispute already exists
  const existingDispute = await prisma.dispute.findFirst({
    where: { order_id: orderId },
  });

  if (existingDispute) {
    throw { statusCode: 400, message: 'A dispute already exists for this order' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create dispute record
      const dispute = await tx.dispute.create({
        data: {
          order_id: orderId,
          buyer_id: userId,
          vendor_id: order.vendor_id,
          reason,
          description,
          status: 'open',
        },
      });

      // Update order escrow status to disputed
      await tx.order.update({
        where: { id: orderId },
        data: {
          escrow_status: 'refunded',
          status: 'disputed',
        },
      });

      // Find the escrow hold transaction
      const escrowHold = await tx.walletTransaction.findFirst({
        where: {
          order_id: orderId,
          tx_type: 'escrow_hold',
          status: 'pending',
        },
      });

      if (escrowHold) {
        // Update escrow hold to refunded
        await tx.walletTransaction.update({
          where: { id: escrowHold.id },
          data: {
            status: 'refunded',
            notes: `Refunded due to dispute: ${reason}`,
          },
        });
      }

      // Refund the amount to buyer's wallet
      await tx.wallet.update({
        where: { user_id: userId },
        data: {
          available_balance: { increment: order.amount },
        },
      });

      // Create transaction record for refund
      await tx.transaction.create({
        data: {
          user_id: userId,
          type: 'refund',
          amount: order.amount,
          status: 'success',
          reference: `DISPUTE-${dispute.id}`,
          description: `Refund for disputed order: ${reason}`,
          counterparty_id: order.vendor.user_id,
          provider: 'vendr',
        },
      });

      // Update vendor's payment_received transaction status to failed
      await tx.transaction.updateMany({
        where: {
          user_id: order.vendor.user_id,
          counterparty_id: order.buyer_id,
          type: 'payment_received',
          status: 'pending',
        },
        data: {
          status: 'failed',
        },
      });

      return { disputeId: dispute.id };
    });

    console.log('[Dispute] Dispute created successfully:', result.disputeId);
    return {
      success: true,
      message: 'Dispute created and payment refunded',
      disputeId: result.disputeId,
    };
  } catch (err: any) {
    console.error('[Dispute] Failed to create dispute:', err);
    throw err;
  }
}

/**
 * Resolve a dispute (admin only)
 * This can either refund to buyer or release to vendor
 */
export async function resolveDispute(
  disputeId: string,
  resolution: 'refund_buyer' | 'release_vendor',
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  console.log('[Dispute] Resolving dispute:', disputeId, 'with resolution:', resolution);

  // Get dispute with order details
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      order: {
        include: {
          vendor: {
            select: { user_id: true },
          },
        },
      },
    },
  });

  if (!dispute) {
    throw { statusCode: 404, message: 'Dispute not found' };
  }

  if (dispute.status !== 'open') {
    throw { statusCode: 400, message: 'This dispute has already been resolved' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = dispute.order;

      if (resolution === 'refund_buyer') {
        // Already refunded when dispute was created, just update status
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'resolved',
            resolution: 'refund_buyer',
            admin_notes: adminNotes,
            resolved_at: new Date(),
          },
        });

        // Update vendor's payment_received transaction status to failed
        await tx.transaction.updateMany({
          where: {
            user_id: order.vendor.user_id,
            counterparty_id: dispute.buyer_id,
            type: 'payment_received',
            status: 'pending',
          },
          data: {
            status: 'failed',
          },
        });
      } else if (resolution === 'release_vendor') {
        // Release funds to vendor
        await tx.wallet.update({
          where: { user_id: order.vendor.user_id },
          data: {
            available_balance: { increment: order.amount },
          },
        });

        // Update vendor's existing payment_received transaction to success
        await tx.transaction.updateMany({
          where: {
            user_id: order.vendor.user_id,
            counterparty_id: dispute.buyer_id,
            type: 'payment_received',
            status: 'pending',
          },
          data: {
            status: 'success',
          },
        });

        // Update order status
        await tx.order.update({
          where: { id: order.id },
          data: {
            escrow_status: 'released',
            status: 'completed',
          },
        });

        // Find and update escrow transaction
        const escrowHold = await tx.walletTransaction.findFirst({
          where: {
            order_id: order.id,
            tx_type: 'escrow_hold',
          },
        });

        if (escrowHold) {
          await tx.walletTransaction.update({
            where: { id: escrowHold.id },
            data: {
              status: 'released',
              notes: `Released after dispute resolution: ${adminNotes || ''}`,
            },
          });
        }

        // Update dispute status
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'resolved',
            resolution: 'release_vendor',
            admin_notes: adminNotes,
            resolved_at: new Date(),
          },
        });
      }
    });

    console.log('[Dispute] Dispute resolved successfully');
    return { success: true, message: 'Dispute resolved successfully' };
  } catch (err: any) {
    console.error('[Dispute] Failed to resolve dispute:', err);
    throw err;
  }
}

/**
 * Get all disputes (admin only)
 */
export async function getAllDisputes(
  status?: 'open' | 'resolved',
  limit = 50,
  offset = 0
): Promise<any[]> {
  const where: any = {};
  if (status) {
    where.status = status;
  }

  const disputes = await prisma.dispute.findMany({
    where,
    include: {
      order: {
        select: {
          id: true,
          amount: true,
          description: true,
          created_at: true,
        },
      },
      buyer: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
      vendor: {
        select: {
          id: true,
          shop_name: true,
        },
      },
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
    status: d.status,
    resolution: d.resolution,
    admin_notes: d.admin_notes,
    created_at: d.created_at.toISOString(),
    resolved_at: d.resolved_at?.toISOString() || null,
  }));
}

/**
 * Get disputes for current user
 */
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
          created_at: true,
        },
      },
      vendor: {
        select: {
          id: true,
          shop_name: true,
        },
      },
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
    status: d.status,
    resolution: d.resolution,
    created_at: d.created_at.toISOString(),
    resolved_at: d.resolved_at?.toISOString() || null,
  }));
}
