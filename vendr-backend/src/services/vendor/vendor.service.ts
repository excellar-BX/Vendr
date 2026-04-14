import prisma from '../../lib/prisma';

// Notification service
const { createNotification } = require('../notification/notification.service');

export interface CreateVendorInput {
  business_name: string;
  category: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp?: string;
  instagram?: string;
  twitter?: string;
  open_days: string[];
  open_time: string;
  close_time: string;
  logo_url?: string | null;
  banner_url?: string | null;
}

/**
 * Create a vendor store for the current user
 * This also sets the user's is_vendor flag to true and updates phone
 * Users can create multiple vendor stores
 */
export async function createVendor(userId: string, input: CreateVendorInput) {
  // Create vendor (note: phone belongs to User, not Vendor)
  const vendor = await prisma.vendor.create({
    data: {
      user_id: userId,
      shop_name: input.business_name,
      category: input.category,
      description: input.description,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      whatsapp: input.whatsapp,
      instagram: input.instagram,
      twitter: input.twitter,
      open_days: input.open_days,
      open_time: input.open_time,
      close_time: input.close_time,
      logo_url: input.logo_url,
      banner_url: input.banner_url,
      is_active: true,
      is_verified: false,
      rating: 0,
      review_count: 0,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          phone: true,
          is_verified: true,
          is_vendor: true,
          is_buyer: true,
          notifications_enabled: true,
          created_at: true,
        }
      }
    }
  });

  // Update user's is_vendor flag and phone number
  await prisma.user.update({
    where: { id: userId },
    data: {
      is_vendor: true,
      phone: input.phone,
    }
  });

  return vendor;
}

/**
 * Get vendor by user ID (authenticated)
 * Returns the most recent vendor for the user (ordered by created_at desc)
 * In multi-vendor scenario, this is the "primary" vendor
 */
export async function getVendorByUserId(userId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          is_vendor_verified: true,
        }
      }
    }
  });

  return vendor;
}

/**
 * Get ALL vendors for a user (authenticated)
 * Used for listing all stores in "My Stores" screen
 */
export async function getAllVendorsByUserId(userId: string) {
  const vendors = await prisma.vendor.findMany({
    where: { user_id: userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          is_vendor_verified: true,
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  return vendors;
}

/**
 * Get vendor by vendor ID (public)
 * Includes owner profile info and stats
 */
export async function getVendorById(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          avatar_url: true,
          created_at: true,
          is_vendor_verified: true,
        }
      }
    }
  });

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' };
  }

  // Get stats
  const [productCount] = await Promise.all([
    prisma.product.count({ where: { vendor_id: vendorId, is_available: true } }),
  ])

  return {
    ...vendor,
    product_count: productCount,
    // user field is already included as owner_profile basically
  }
}

/**
 * Update vendor settings
 * Updates the most recent vendor for the user (by created_at desc)
 */
export async function updateVendor(userId: string, input: Partial<CreateVendorInput> & { is_active?: boolean; is_verified?: boolean }) {
  // Find the most recent vendor for this user
  const existingVendor = await prisma.vendor.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' }
  });

  if (!existingVendor) {
    throw { statusCode: 404, message: 'Vendor not found' };
  }

  const vendor = await prisma.vendor.update({
    where: { id: existingVendor.id },
    data: {
      ...(input.business_name && { shop_name: input.business_name }),
      ...(input.category && { category: input.category }),
      ...(input.description && { description: input.description }),
      ...(input.address && { address: input.address }),
      ...(input.lat && { lat: input.lat }),
      ...(input.lng && { lng: input.lng }),
      ...(input.phone && { phone: input.phone }),
      ...(input.whatsapp && { whatsapp: input.whatsapp }),
      ...(input.instagram && { instagram: input.instagram }),
      ...(input.twitter && { twitter: input.twitter }),
      ...(input.open_days && { open_days: input.open_days }),
      ...(input.open_time && { open_time: input.open_time }),
      ...(input.close_time && { close_time: input.close_time }),
      ...(input.logo_url !== undefined && { logo_url: input.logo_url }),
      ...(input.banner_url !== undefined && { banner_url: input.banner_url }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
      ...(input.is_verified !== undefined && { is_verified: input.is_verified }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
        }
      }
    }
  });

  // Note: Vendor verification is now handled via user.is_vendor_verified
  // No notification needed here since verification is managed through the verification service

  return vendor;
}

/**
 * Deactivate vendor store (soft delete)
 * Could also hard delete if needed
 */
export async function deleteVendorStore(userId: string): Promise<void> {
  const vendor = await prisma.vendor.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' }
  })

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' }
  }

  // Option 1: Soft delete - deactivate
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      is_active: false,
    },
  })

  // Also deactivate all products? Or keep them for history?
  // For now, just deactivate vendor. Products remain but vendor not visible.

  // Option 2: Hard delete cascade (uncomment if desired)
  // await prisma.vendor.delete({ where: { id: vendor.id } })
}

/**
 * Update a specific vendor by ID (authenticated)
 * Ensures the vendor belongs to the authenticated user
 */
export async function updateVendorById(vendorId: string, userId: string, input: Partial<CreateVendorInput> & { is_active?: boolean; is_verified?: boolean }) {
  // Verify ownership
  const existing = await prisma.vendor.findFirst({
    where: { id: vendorId, user_id: userId }
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Vendor not found or access denied' };
  }

  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(input.business_name && { shop_name: input.business_name }),
      ...(input.category && { category: input.category }),
      ...(input.description && { description: input.description }),
      ...(input.address && { address: input.address }),
      ...(input.lat && { lat: input.lat }),
      ...(input.lng && { lng: input.lng }),
      ...(input.phone && { phone: input.phone }),
      ...(input.whatsapp && { whatsapp: input.whatsapp }),
      ...(input.instagram && { instagram: input.instagram }),
      ...(input.twitter && { twitter: input.twitter }),
      ...(input.open_days && { open_days: input.open_days }),
      ...(input.open_time && { open_time: input.open_time }),
      ...(input.close_time && { close_time: input.close_time }),
      ...(input.logo_url !== undefined && { logo_url: input.logo_url }),
      ...(input.banner_url !== undefined && { banner_url: input.banner_url }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
      ...(input.is_verified !== undefined && { is_verified: input.is_verified }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
        }
      }
    }
  });

  return vendor;
}

/**
 * Delete (deactivate) a specific vendor by ID (authenticated)
 * Ensures the vendor belongs to the authenticated user
 */
export async function deleteVendorById(vendorId: string, userId: string): Promise<void> {
  // Verify ownership
  const existing = await prisma.vendor.findFirst({
    where: { id: vendorId, user_id: userId }
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Vendor not found or access denied' };
  }

  // Soft delete - deactivate
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      is_active: false,
    },
  });
}

