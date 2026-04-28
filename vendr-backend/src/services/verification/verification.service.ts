import prisma from '../../lib/prisma';

const { createNotification } = require('../notification/notification.service');

export interface SubmitVerificationInput {
  vendor_id: string;
  cac_number?: string;
  nin_number?: string;
  business_address?: string;
  documents?: Record<string, string>; // URLs to uploaded documents
}

export interface ReviewVerificationInput {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
  verification_tier?: 'basic' | 'premium';
}

/**
 * Submit a verification request for a vendor
 */
export async function submitVerification(userId: string, input: SubmitVerificationInput) {
  // Verify the vendor belongs to the user
  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendor_id, user_id: userId },
  });

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found or access denied' };
  }

  // Check if there's already a pending verification request
  const existingRequest = await prisma.verificationRequest.findFirst({
    where: { vendor_id: input.vendor_id, status: 'pending' },
  });

  if (existingRequest) {
    throw { statusCode: 400, message: 'Verification request already pending' };
  }

  // Create verification request
  const verificationRequest = await prisma.verificationRequest.create({
    data: {
      vendor_id: input.vendor_id,
      status: 'pending',
      cac_number: input.cac_number,
      nin_number: input.nin_number,
      business_address: input.business_address,
      documents: input.documents || {},
    },
  });

  return verificationRequest;
}

/**
 * Get verification request by vendor ID
 */
export async function getVerificationByVendorId(vendorId: string) {
  const verification = await prisma.verificationRequest.findFirst({
    where: { vendor_id: vendorId },
    orderBy: { created_at: 'desc' },
  });

  return verification;
}

/**
 * Get all pending verification requests (admin)
 */
export async function getPendingVerifications() {
  const verifications = await prisma.verificationRequest.findMany({
    where: { status: 'pending' },
    include: {
      vendor: {
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
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return verifications;
}

/**
 * Review a verification request (admin)
 */
export async function reviewVerification(
  verificationId: string,
  reviewerId: string,
  input: ReviewVerificationInput
) {
  const verification = await prisma.verificationRequest.findUnique({
    where: { id: verificationId },
    include: { vendor: true },
  });

  if (!verification) {
    throw { statusCode: 404, message: 'Verification request not found' };
  }

  if (verification.status !== 'pending') {
    throw { statusCode: 400, message: 'Verification request already reviewed' };
  }

  // Update verification request
  const updatedVerification = await prisma.verificationRequest.update({
    where: { id: verificationId },
    data: {
      status: input.status,
      reviewed_at: new Date(),
      reviewer_id: reviewerId,
      rejection_reason: input.rejection_reason,
    },
  });

  // If approved, update user's vendor verification status
  if (input.status === 'approved') {
    await prisma.user.update({
      where: { id: verification.vendor.user_id },
      data: {
        is_vendor_verified: true,
      },
    });

    // Also update vendor verification tier
    await prisma.vendor.update({
      where: { id: verification.vendor_id },
      data: {
        verification_tier: input.verification_tier || 'basic',
      },
    });

    // Send notification to vendor
    try {
      await createNotification({
        userId: verification.vendor.user_id,
        type: 'verification_approved',
        title: 'Verification Approved',
        body: 'Your vendor account has been verified!',
        data: { vendor_id: verification.vendor_id },
      });
    } catch (notifError) {
      console.error('[Verification] Notification error:', notifError);
    }
  } else {
    // Send rejection notification
    try {
      await createNotification({
        userId: verification.vendor.user_id,
        type: 'verification_rejected',
        title: 'Verification Rejected',
        body: input.rejection_reason || 'Your verification request was rejected. Please resubmit with correct information.',
        data: { vendor_id: verification.vendor_id, reason: input.rejection_reason },
      });
    } catch (notifError) {
      console.error('[Verification] Notification error:', notifError);
    }
  }

  return updatedVerification;
}

/**
 * Get verification status for a vendor
 */
export async function getVerificationStatus(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: {
        select: {
          id: true,
          is_vendor_verified: true,
        },
      },
    },
  });

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' };
  }

  const latestRequest = await prisma.verificationRequest.findFirst({
    where: { vendor_id: vendorId },
    orderBy: { created_at: 'desc' },
  });

  return {
    is_verified: vendor.user.is_vendor_verified,
    verification_tier: vendor.verification_tier,
    latest_request: latestRequest,
  };
}
