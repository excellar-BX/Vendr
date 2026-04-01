import prisma from '../../lib/prisma'
import type { GetMyProfileOutput, UpdatePreferencesInput, UpdateMyProfileInput } from './user.schema'

export async function getMyProfile(userId: string): Promise<GetMyProfileOutput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      notifications_enabled: true,
      location_enabled: true,
      created_at: true,
      vendor: {
        select: { id: true, shop_name: true, is_active: true }
      }
    }
  })

  if (!user) {
    throw { statusCode: 404, message: 'User not found' }
  }

  // Get stats
  const [ordersCount, reviewsCount, savedCount, unreadNotifications] = await Promise.all([
    prisma.order.count({ where: { buyer_id: userId } }),
    prisma.review.count({ where: { user_id: userId } }),
    prisma.savedVendor.count({ where: { user_id: userId } }),
    prisma.notification.count({ where: { user_id: userId, is_read: false } })
  ])

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    phone: user.phone,
    is_verified: user.is_verified,
    notifications_enabled: user.notifications_enabled,
    location_enabled: user.location_enabled,
    created_at: user.created_at.toISOString(),
    vendor: user.vendor,
    stats: {
      orders: ordersCount,
      reviews: reviewsCount,
      saved: savedCount
    },
    unread_notifications_count: unreadNotifications
  }
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.notifications_enabled !== undefined && { notifications_enabled: input.notifications_enabled }),
      ...(input.location_enabled !== undefined && { location_enabled: input.location_enabled }),
    },
    select: {
      id: true,
      notifications_enabled: true,
      location_enabled: true
    }
  })

  return user
}

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.full_name !== undefined && { full_name: input.full_name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.avatar_url !== undefined && { avatar_url: input.avatar_url }),
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      notifications_enabled: true,
      location_enabled: true,
      created_at: true,
      vendor: {
        select: { id: true, shop_name: true, is_active: true }
      }
    }
  })

  // Convert Date to ISO string for JSON serialization
  return {
    ...user,
    created_at: user.created_at.toISOString()
  }
}

export async function deleteMyAccount(userId: string) {
  // Soft delete
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      is_deleted: true,
      deleted_at: new Date()
    },
    select: { id: true, email: true }
  })

  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({ where: { user_id: userId } })

  return user
}
