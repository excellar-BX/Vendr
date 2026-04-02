import prisma from '../../lib/prisma'
import { deleteFiles } from '../storage/storage.service'
import type { CreateReelInput, ReelOutput } from './reel.schema'

/**
 * Get reels by vendor_id
 * Public shows all reels; authenticated can include non-active if needed
 */
export async function getReelsByVendor(vendorId: string, includeAll: boolean = false): Promise<ReelOutput[]> {
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
export async function createReel(userId: string, input: CreateReelInput): Promise<ReelOutput> {
  // Get user's vendor
  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })

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
 * Get single reel by ID
 */
export async function getReelById(reelId: string): Promise<ReelOutput> {
  const reel = await prisma.reel.findUnique({ where: { id: reelId } })

  if (!reel) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

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
 * Delete reel (vendor only, ownership enforced)
 * Also deletes associated files from R2 storage
 */
export async function deleteReel(reelId: string, userId: string): Promise<void> {
  const reel = await prisma.reel.findUnique({ where: { id: reelId } })

  if (!reel) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })
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
      // Continue with DB deletion even if storage fails (maybe log but don't block)
    }
  }

  await prisma.reel.delete({ where: { id: reelId } })
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
export async function getSavedReels(userId: string): Promise<ReelOutput[]> {
  const savedReels = await prisma.reelSave.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      reel: true
    }
  })

  return savedReels.map(s => s.reel).map(reel => ({
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
  }))
}
