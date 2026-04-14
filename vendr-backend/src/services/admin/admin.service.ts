import { prisma } from '../../lib/prisma'

// Dashboard Stats
export async function getDashboardStats() {
  const [
    totalUsers,
    totalVendors,
    totalWaitlist,
    totalOrders,
    totalWalletBalance,
    activeDisputes,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.waitlist.count(),
    prisma.order.count(),
    prisma.wallet.aggregate({
      _sum: { available_balance: true },
    }),
    prisma.dispute.count({ where: { status: 'open' } }),
  ])

  return {
    totalUsers,
    totalVendors,
    totalWaitlist,
    totalOrders,
    totalWalletBalance: totalWalletBalance._sum.available_balance || 0,
    activeDisputes,
  }
}

// Get all verification requests
export async function getVerificationRequests() {
  return await prisma.verification_request.findMany({
    include: {
      vendor: {
        include: {
          user: {
            select: {
              full_name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { submitted_at: 'desc' },
  })
}

// Approve verification request
export async function approveVerificationRequest(requestId: string) {
  const request = await prisma.verification_request.findUnique({
    where: { id: requestId },
    include: { vendor: { include: { user: true } } },
  })

  if (!request) throw new Error('Verification request not found')

  await prisma.$transaction([
    prisma.verification_request.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewed_at: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: request.vendor.user_id },
      data: { is_vendor_verified: true },
    }),
  ])

  return { success: true }
}

// Reject verification request
export async function rejectVerificationRequest(requestId: string, reason?: string) {
  await prisma.verification_request.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      reviewed_at: new Date(),
      rejection_reason: reason,
    },
  })

  return { success: true }
}

// Get all users
export async function getUsers(limit = 50, offset = 0, search?: string) {
  const where = search
    ? {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        plan: true,
        is_verified: true,
        is_vendor_verified: true,
        created_at: true,
        is_deleted: true,
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

// Soft delete user
export async function softDeleteUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { is_deleted: true, deleted_at: new Date() },
  })

  return { success: true }
}

// Get all vendors
export async function getVendors(limit = 50, offset = 0, search?: string) {
  const where = search
    ? {
        OR: [
          { shop_name: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.vendor.count({ where }),
  ])

  return { vendors, total }
}

// Toggle vendor fraud flag
export async function toggleVendorFraudFlag(vendorId: string, isFlagged: boolean, reason?: string) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      is_fraud_flagged: isFlagged,
      fraud_flag_reason: isFlagged ? reason : null,
      fraud_flagged_at: isFlagged ? new Date() : null,
    },
  })

  return { success: true }
}

// Suspend vendor
export async function suspendVendor(vendorId: string) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { is_active: false },
  })

  return { success: true }
}

// Get all orders
export async function getOrders(limit = 50, offset = 0, escrowStatus?: string) {
  const where = escrowStatus ? { escrow_status: escrowStatus } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        buyer: { select: { full_name: true } },
        vendor: { select: { shop_name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total }
}

// Manual release escrow
export async function manualReleaseEscrow(orderId: string) {
  // This would call the existing escrow release logic
  // For now, just update the status
  await prisma.order.update({
    where: { id: orderId },
    data: { escrow_status: 'released' },
  })

  return { success: true }
}

// Cancel order
export async function cancelOrder(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { escrow_status: 'refunded', status: 'cancelled' },
  })

  return { success: true }
}

// Get waitlist entries
export async function getWaitlist() {
  return await prisma.waitlist.findMany({
    orderBy: { created_at: 'desc' },
  })
}

// Get transactions
export async function getTransactions(limit = 50, offset = 0, status?: string, type?: string) {
  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        user: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.transaction.count({ where }),
  ])

  return { transactions, total }
}

// Get wallet transactions
export async function getWalletTransactions(limit = 50, offset = 0, txType?: string) {
  const where = txType ? { tx_type: txType } : {}

  const [transactions, total] = await Promise.all([
    prisma.wallet_transaction.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        vendor: { select: { shop_name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.wallet_transaction.count({ where }),
  ])

  return { transactions, total }
}
