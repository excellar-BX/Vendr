import prisma from '../../lib/prisma'
import { deleteFiles } from '../storage/storage.service'
import type { CreateReInput, ReelOutput, ReelEnriched, VendorInfo, ProductInfo, ToggleResponse } from './reel.schema'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function enrichReels(
  reels: any[],
  userId?: string
): Promise<ReelEnriched[]> {
  // Map Prisma reel to enriched structure with vendor & product
  const enriched: ReelEnriched[] = reels.map(r => ({
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    caption: r.caption,
    product_id: r.product_id,
    view_count: r.view_count,
    like_count: r.like_count,
    save_count: r.save_count,
    is_active: r.is_active,
    created_at: r.created_at.toISOString(),
    vendor: r.vendor ? {
      business_name: r.vendor.shop_name,
      logo_url: r.vendor.logo_url,
      is_verified: r.vendor.user?.is_vendor_verified,
      category: r.vendor.category,
    } : null,
    product: r.product ? {
      name: r.product.name,
      price: r.product.price,
      image_url: r.product.image_url,
    } : null,
    is_liked: false,
    is_saved: false,
  }))

  if (!userId) {
    return enriched
  }

  // Batch fetch like/save status for these reels
  const reelIds = enriched.map(e => e.id)
  const [likedRows, savedRows] = await Promise.all([
    prisma.reelLike.findMany({
      where: { user_id: userId, reel_id: { in: reelIds } },
      select: { reel_id: true },
    }),
    prisma.reelSave.findMany({
      where: { user_id: userId, reel_id: { in: reelIds } },
      select: { reel_id: true },
    }),
  ])

  const likedSet = new Set(likedRows.map((l: any) => l.reel_id))
  const savedSet = new Set(savedRows.map((s: any) => s.reel_id))

  // Apply flags
  return enriched.map(e => ({
    ...e,
    is_liked: likedSet.has(e.id),
    is_saved: savedSet.has(e.id),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Public / Feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get reels feed (all active reels, ordered by creation date)
 * Optionally include user's like/save status if userId is provided
 */
export async function getReelFeed(params: {
  userId?: string
  limit?: number
  offset?: number
} = {}): Promise<ReelEnriched[]> {
  const { userId, limit = 20, offset = 0 } = params

  const reels = await prisma.reel.findMany({
    where: { is_active: true },
    include: {
      vendor: {
        include: {
          user: {
            select: {
              is_vendor_verified: true,
            },
          },
        },
      },
      product: true,
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  })

  return enrichReels(reels, userId)
}

/**
 * Get reels by vendor_id
 * If includeAll=true (vendor only), includes inactive reels
 * Optionally include user's like/save status if userId is provided
 */
export async function getReelsByVendor(
  vendorId: string,
  params: {
    includeAll?: boolean
    userId?: string
    limit?: number
    offset?: number
  } = {}
): Promise<ReelEnriched[]> {
  const { includeAll = false, userId, limit = 20, offset = 0 } = params

  const where: any = { vendor_id: vendorId }
  if (!includeAll) {
    where.is_active = true
  }

  const reels = await prisma.reel.findMany({
    where,
    include: {
      vendor: {
        include: {
          user: {
            select: {
              is_vendor_verified: true,
            },
          },
        },
      },
      product: true,
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  })

  return enrichReels(reels, userId)
}

/**
 * Get single reel by ID with enriched data
 */
export async function getReelById(
  reelId: string,
  userId?: string
): Promise<ReelEnriched> {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    include: {
      vendor: true,
      product: true,
    },
  })

  if (!reel) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

  const [enriched] = await enrichReels([reel], userId)
  return enriched!
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions (Like/Save)
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleLike(
  reelId: string,
  userId: string
): Promise<ToggleResponse> {
  // Check existing like
  const existing = await prisma.reelLike.findUnique({
    where: {
      user_id_reel_id: {
        user_id: userId,
        reel_id: reelId,
      },
    },
  })

  if (existing) {
    // Unlike
    await prisma.reelLike.delete({
      where: { id: existing.id },
    })
    // Decrement like count on reel
    await prisma.reel.update({
      where: { id: reelId },
      data: { like_count: { decrement: 1 } },
    })
    return { liked: false }
  } else {
    // Like
    await prisma.reelLike.create({
      data: {
        user_id: userId,
        reel_id: reelId,
      },
    })
    // Increment like count on reel
    await prisma.reel.update({
      where: { id: reelId },
      data: { like_count: { increment: 1 } },
    })
    return { liked: true }
  }
}

export async function toggleSave(
  reelId: string,
  userId: string
): Promise<ToggleResponse> {
  const existing = await prisma.reelSave.findUnique({
    where: {
      user_id_reel_id: {
        user_id: userId,
        reel_id: reelId,
      },
    },
  })

  if (existing) {
    // Unsave
    await prisma.reelSave.delete({
      where: { id: existing.id },
    })
    // Decrement save count on reel
    await prisma.reel.update({
      where: { id: reelId },
      data: { save_count: { decrement: 1 } },
    })
    return { saved: false }
  } else {
    // Save
    await prisma.reelSave.create({
      data: {
        user_id: userId,
        reel_id: reelId,
      },
    })
    // Increment save count on reel
    await prisma.reel.update({
      where: { id: reelId },
      data: { save_count: { increment: 1 } },
    })
    return { saved: true }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing functions (updated return types where needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get reels by vendor_id (legacy - returns basic ReelOutput)
 * This is kept for backward compatibility but new endpoints use enriched
 */
export async function getReelsByVendorBasic(
  vendorId: string,
  includeAll: boolean = false
): Promise<ReelOutput[]> {
  const where: any = { vendor_id: vendorId }
  if (!includeAll) {
    where.is_active = true
  }

  const reels = await prisma.reel.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return reels.map(r => ({
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    caption: r.caption,
    product_id: r.product_id,
    view_count: r.view_count,
    like_count: r.like_count,
    save_count: r.save_count,
    is_active: r.is_active,
    created_at: r.created_at.toISOString(),
  }))
}

/**
 * Create a new reel for the vendor
 */
export async function createReel(
  userId: string,
  input: CreateReInput
): Promise<ReelOutput> {
  const vendor = await prisma.vendor.findFirst({
    where: { user_id: userId }
  })

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found. Become a vendor first.' }
  }

  const reel = await prisma.reel.create({
    data: {
      vendor_id: vendor.id,
      user_id: userId,
      video_url: input.video_url,
      thumbnail_url: input.thumbnail_url,
      caption: input.caption,
      product_id: input.product_id,
    },
  })

  return {
    id: reel.id,
    vendor_id: reel.vendor_id,
    user_id: reel.user_id,
    video_url: reel.video_url,
    thumbnail_url: reel.thumbnail_url,
    caption: reel.caption,
    product_id: reel.product_id,
    view_count: reel.view_count,
    like_count: reel.like_count,
    save_count: reel.save_count,
    is_active: reel.is_active,
    created_at: reel.created_at.toISOString(),
  }
}

/**
 * Increment view count for a reel
 */
export async function incrementReelViewCount(reelId: string): Promise<void> {
  await prisma.reel.update({
    where: { id: reelId },
    data: { view_count: { increment: 1 } },
  })
}

/**
 * Get reels saved by a user (with full reel details)
 */
export async function getSavedReels(
  userId: string
): Promise<ReelEnriched[]> {
  const savedReels = await prisma.reelSave.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      reel: {
        include: {
          vendor: {
            include: {
              user: {
                select: {
                  is_vendor_verified: true,
                },
              },
            },
          },
          product: true,
        },
      },
    },
  })

  const reels = savedReels.map(s => s.reel)
  return enrichReels(reels, userId)
}

/**
 * Delete reel (vendor only, ownership enforced)
 * Also deletes associated files from R2 storage
 */
export async function deleteReel(
  reelId: string,
  userId: string
): Promise<void> {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId }
  })

  if (!reel) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

  const vendor = await prisma.vendor.findFirst({
    where: { user_id: userId }
  })
  if (!vendor || vendor.id !== reel.vendor_id) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // Delete files from storage
  const filesToDelete: string[] = []
  if (reel.video_url) filesToDelete.push(reel.video_url)
  if (reel.thumbnail_url) filesToDelete.push(reel.thumbnail_url)

  if (filesToDelete.length > 0) {
    try {
      await deleteFiles(filesToDelete)
    } catch (err) {
      console.error('Failed to delete storage files:', err)
      // Continue with DB deletion even if storage fails
    }
  }

  await prisma.reel.delete({ where: { id: reelId } })
}
