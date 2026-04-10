import prisma from '../../lib/prisma'
import type { SavedVendorInput, SavedVendorOutput } from './saved-vendor.schema'

// Notification service
const { createNotification } = require('../notification/notification.service')

/**
 * Save a vendor (add to saved list)
 */
export async function saveVendor(userId: string, input: SavedVendorInput): Promise<SavedVendorOutput> {
  const vendorId = input.vendor_id

  // Check if vendor exists
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' }
  }

  // Prevent saving own vendor
  if (vendor.user_id === userId) {
    throw { statusCode: 400, message: 'Cannot save your own vendor' }
  }

  // Check if already saved
  const existing = await prisma.savedVendor.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: vendorId,
      },
    },
  })

  if (existing) {
    throw { statusCode: 409, message: 'Vendor already saved' }
  }

  const saved = await prisma.savedVendor.create({
    data: {
      user_id: userId,
      vendor_id: vendorId,
    },
  })

  // Create notification for the vendor (non-blocking)
  try {
    await createNotification({
      userId: vendor.user_id,
      type: 'store_saved',
      title: 'Store saved',
      body: 'Someone saved your store',
      data: { vendor_id: vendorId },
    })
  } catch (notifError) {
    console.error('[SavedVendor] Notification error:', notifError)
    // Don't throw - vendor was successfully saved
  }

  return {
    id: saved.id,
    user_id: saved.user_id,
    vendor_id: saved.vendor_id,
    created_at: saved.created_at.toISOString(),
  }
}

/**
 * Unsave a vendor (remove from saved list)
 */
export async function unsaveVendor(userId: string, vendorId: string): Promise<void> {
  const saved = await prisma.savedVendor.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: vendorId,
      },
    },
  })

  if (!saved) {
    throw { statusCode: 404, message: 'Vendor not saved' }
  }

  await prisma.savedVendor.delete({
    where: { id: saved.id },
  })
}

/**
 * Check if vendor is saved by user
 */
export async function isVendorSaved(userId: string, vendorId: string): Promise<boolean> {
  const saved = await prisma.savedVendor.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: vendorId,
      },
    },
  })

  return !!saved
}

/**
 * Get all saved vendors for a user
 */
export async function getSavedVendors(userId: string): Promise<(SavedVendorOutput & { vendor: any })[]> {
  const savedList = await prisma.savedVendor.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      vendor: {
        select: {
          id: true,
          shop_name: true,
          category: true,
          address: true,
          rating: true,
          review_count: true,
          is_verified: true,
          is_active: true,
          logo_url: true,
          banner_url: true,
          lat: true,
          lng: true,
          phone: true,
          whatsapp: true,
          instagram: true,
          twitter: true,
          open_days: true,
          open_time: true,
          close_time: true,
          description: true,
        },
      },
    },
  })

  return savedList.map(s => ({
    id: s.id,
    user_id: s.user_id,
    vendor_id: s.vendor_id,
    created_at: s.created_at.toISOString(),
    vendor: s.vendor,
  }))
}
