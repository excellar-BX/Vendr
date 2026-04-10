import prisma from '../../lib/prisma'
import type { CreateReviewInput, UpdateReviewInput, ReviewOutput } from './review.schema'

/**
 * Recalculate vendor rating statistics
 */
async function recalculateVendorRating(vendorId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { vendor_id: vendorId },
    select: { rating: true },
  })

  const total = reviews.length
  const average = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      rating: Math.round(average * 10) / 10, // Round to 1 decimal
      review_count: total,
    },
  })
}

/**
 * Get reviews for a vendor (public)
 */
export async function getReviewsByVendor(vendorId: string): Promise<ReviewOutput[]> {
  const reviews = await prisma.review.findMany({
    where: { vendor_id: vendorId },
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: {
          full_name: true,
          avatar_url: true,
        },
      },
    },
  })

  return reviews.map(r => ({
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at.toISOString(),
    reviewer_name: r.user?.full_name ?? null,
    reviewer_avatar: r.user?.avatar_url ?? null,
  }))
}

/**
 * Get reviews written by a user (reviews left by user)
 */
export async function getReviewsByUser(userId: string): Promise<(ReviewOutput & { vendor_name: string })[]> {
  const reviews = await prisma.review.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: {
      vendor: {
        select: {
          shop_name: true
        }
      },
      user: {
        select: {
          full_name: true
        }
      }
    }
  })

  return reviews.map(r => ({
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at.toISOString(),
    reviewer_name: r.user?.full_name ?? null,
    vendor_name: r.vendor?.shop_name ?? 'Unknown Vendor'
  }))
}

/**
 * Get reviews received for a vendor's store (by vendor_user_id)
 * This is for vendors to see reviews customers left for their store
 */
export async function getReviewsReceivedForVendor(vendorUserId: string): Promise<ReviewOutput[]> {
  const reviews = await prisma.review.findMany({
    where: {
      vendor: {
        user_id: vendorUserId
      }
    },
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: {
          full_name: true,
          avatar_url: true,
        },
      },
      vendor: {
        select: {
          shop_name: true
        }
      }
    }
  })

  return reviews.map(r => ({
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at.toISOString(),
    reviewer_name: r.user?.full_name ?? 'Anonymous',
    reviewer_avatar: r.user?.avatar_url ?? null,
  }))
}

/**
 * Create a review (one per user per vendor)
 */
export async function createReview(userId: string, input: CreateReviewInput): Promise<ReviewOutput> {
  // Check if user already reviewed this vendor
  const existing = await prisma.review.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: input.vendor_id,
      },
    },
  })

  if (existing) {
    throw { statusCode: 409, message: 'You have already reviewed this vendor' }
  }

  // Verify vendor exists
  const vendor = await prisma.vendor.findUnique({ where: { id: input.vendor_id } })
  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' }
  }

  // Prevent vendor from reviewing their own store? (Optional business rule)
  if (vendor.user_id === userId) {
    throw { statusCode: 400, message: 'You cannot review your own store' }
  }

  const review = await prisma.review.create({
    data: {
      user_id: userId,
      vendor_id: input.vendor_id,
      rating: input.rating,
      comment: input.comment,
    },
    include: {
      user: {
        select: { full_name: true },
      },
    },
  })

  // Recalculate vendor rating
  await recalculateVendorRating(input.vendor_id)

  return {
    id: review.id,
    vendor_id: review.vendor_id,
    user_id: review.user_id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at.toISOString(),
    reviewer_name: review.user?.full_name ?? null,
  }
}

/**
 * Get single review by ID (for ownership check)
 */
export async function getReviewById(reviewId: string): Promise<{ user_id: string; vendor_id: string }> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, user_id: true, vendor_id: true },
  })

  if (!review) {
    throw { statusCode: 404, message: 'Review not found' }
  }

  return review
}

/**
 * Update review (only by reviewer)
 */
export async function updateReview(reviewId: string, userId: string, input: UpdateReviewInput): Promise<ReviewOutput> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      user: {
        select: { full_name: true },
      },
    },
  })

  if (!review) {
    throw { statusCode: 404, message: 'Review not found' }
  }

  if (review.user_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(input.rating && { rating: input.rating }),
      ...(input.comment !== undefined && { comment: input.comment }),
    },
    include: {
      user: {
        select: { full_name: true },
      },
    },
  })

  // Recalculate vendor rating
  await recalculateVendorRating(review.vendor_id)

  return {
    id: updated.id,
    vendor_id: updated.vendor_id,
    user_id: updated.user_id,
    rating: updated.rating,
    comment: updated.comment,
    created_at: updated.created_at.toISOString(),
    reviewer_name: updated.user?.full_name ?? null,
  }
}

/**
 * Delete review (only by reviewer or vendor owner via separate endpoint?)
 * For now: only reviewer can delete
 */
export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, user_id: true, vendor_id: true },
  })

  if (!review) {
    throw { statusCode: 404, message: 'Review not found' }
  }

  if (review.user_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const vendorId = review.vendor_id
  await prisma.review.delete({ where: { id: reviewId } })

  // Recalculate vendor rating
  await recalculateVendorRating(vendorId)
}
