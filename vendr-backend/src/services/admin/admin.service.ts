import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../lib/prisma'
import { env } from '../../config/env'

// ─── Admin Auth ──────────────────────────────────────────────────────────────────

function generateAdminToken(payload: { id: string; email: string }) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export async function adminLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      password: true,
      is_deleted: true,
    },
  })

  if (!user || !user.password) {
    throw new Error('Invalid email or password')
  }

  if (user.is_deleted) {
    throw new Error('Account has been deleted')
  }

  // Check if user has admin role
  if (user.role !== 'admin') {
    throw new Error('Access denied: Admin privileges required')
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new Error('Invalid email or password')
  }

  const token = generateAdminToken({ id: user.id, email: user.email })

  const { password: _pw, ...safeUser } = user
  return {
    data: {
      accessToken: token,
      user: safeUser,
    },
  }
}

export async function adminMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      is_deleted: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.is_deleted) {
    throw new Error('Account has been deleted')
  }

  if (user.role !== 'admin') {
    throw new Error('Access denied: Admin privileges required')
  }

  return {
    data: user,
  }
}

// Dashboard Stats
export async function getDashboardStats() {
  const [
    totalUsers,
    totalVendors,
    totalOrders,
    totalWalletBalance,
    activeDisputes,
    pendingVerifications,
    approvedVerifications,
    rejectedVerifications,
    pendingOrders,
    completedOrders,
    disputedOrders,
    totalTransactions,
    todayTransactions,
    buyersCount,
    newUsersThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.order.count(),
    prisma.wallet.aggregate({
      _sum: { available_balance: true },
    }),
    prisma.dispute.count({ where: { status: 'open' } }),
    prisma.verificationRequest.count({ where: { status: 'pending' } }),
    prisma.verificationRequest.count({ where: { status: 'approved' } }),
    prisma.verificationRequest.count({ where: { status: 'rejected' } }),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.order.count({ where: { status: 'completed' } }),
    prisma.order.count({ where: { status: 'disputed' } }),
    prisma.transaction.count(),
    prisma.transaction.count({
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.user.count({ where: { is_buyer: true } }),
    prisma.user.count({
      where: {
        created_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  const totalVolume = await prisma.transaction.aggregate({
    _sum: { amount: true },
  })

  const todayVolume = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      created_at: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  })

  return {
    users: {
      total: totalUsers,
      buyers: buyersCount,
      vendors: totalVendors,
      new_this_week: newUsersThisWeek,
    },
    transactions: {
      total_volume: totalVolume._sum.amount || 0,
      count: totalTransactions,
      today_volume: todayVolume._sum.amount || 0,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
      disputed: disputedOrders,
    },
    verifications: {
      pending: pendingVerifications,
      approved: approvedVerifications,
      rejected: rejectedVerifications,
    },
  }
}

// Get all verification requests
export async function getVerificationRequests() {
  return await prisma.verificationRequest.findMany({
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
export async function getUsers(limit = 50, offset = 0, search?: string, role?: string) {
  const where: any = {}

  if (search) {
    where.OR = [
      { full_name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ]
  }

  if (role) {
    where.role = role
  }

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

// Get single user
export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      is_vendor_verified: true,
      is_buyer: true,
      is_vendor: true,
      is_deleted: true,
      role: true,
      plan: true,
      created_at: true,
      google_id: true,
      notifications_enabled: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  return { user }
}

// Update user
export async function updateUser(userId: string, data: any) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      is_vendor_verified: true,
      is_buyer: true,
      is_vendor: true,
      is_deleted: true,
      role: true,
      plan: true,
      created_at: true,
      google_id: true,
      notifications_enabled: true,
    },
  })

  return { user }
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

// Flag vendor
export async function flagVendor(vendorId: string, reason: string) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      is_fraud_flagged: true,
      fraud_flag_reason: reason,
      fraud_flagged_at: new Date(),
    },
  })

  return { success: true }
}

// Unflag vendor
export async function unflagVendor(vendorId: string) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      is_fraud_flagged: false,
      fraud_flag_reason: null,
      fraud_flagged_at: null,
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

// Get single vendor
export async function getVendor(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          phone: true,
        },
      },
    },
  })

  if (!vendor) {
    throw new Error('Vendor not found')
  }

  return { vendor }
}

// Get all orders
export async function getOrders(limit = 50, offset = 0, status?: string) {
  const where = status ? { status } : {}

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

// Get disputes
export async function getDisputes(limit = 50, offset = 0, status?: string) {
  const where = status ? { status } : {}

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        buyer: { select: { full_name: true, email: true } },
        vendor: { select: { shop_name: true } },
        order: { select: { id: true, amount: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.dispute.count({ where }),
  ])

  return { disputes, total }
}

// Resolve dispute
export async function resolveDispute(disputeId: string, resolution: string) {
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'resolved',
      resolution,
      resolved_at: new Date(),
    },
  })

  return { success: true }
}
