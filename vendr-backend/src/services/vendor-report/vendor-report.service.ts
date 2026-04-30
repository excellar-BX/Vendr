import prisma from '../../lib/prisma'
import type { VendorReportInput, UpdateVendorReportInput } from './vendor-report.schema'

/**
 * Submit a vendor report (buyer action)
 */
export async function submitVendorReport(userId: string, input: VendorReportInput) {
  const { vendor_id, reason, description } = input

  // Check if vendor exists
  const vendor = await prisma.vendor.findUnique({ where: { id: vendor_id } })
  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' }
  }

  // Prevent reporting own vendor
  if (vendor.user_id === userId) {
    throw { statusCode: 400, message: 'Cannot report your own vendor' }
  }

  // Check if already reported (unique constraint will handle this, but we give a friendly error)
  const existing = await prisma.vendorReport.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: vendor_id,
      },
    },
  })

  if (existing) {
    throw { statusCode: 409, message: 'You have already reported this vendor' }
  }

  const report = await prisma.vendorReport.create({
    data: {
      user_id: userId,
      vendor_id: vendor_id,
      reason,
      description,
    },
  })

  return {
    id: report.id,
    vendor_id: report.vendor_id,
    user_id: report.user_id,
    reason: report.reason,
    description: report.description,
    status: report.status,
    created_at: report.created_at.toISOString(),
  }
}

/**
 * Check if user has reported a vendor
 */
export async function hasUserReportedVendor(userId: string, vendorId: string): Promise<boolean> {
  const report = await prisma.vendorReport.findUnique({
    where: {
      user_id_vendor_id: {
        user_id: userId,
        vendor_id: vendorId,
      },
    },
  })

  return !!report
}

/**
 * Get all vendor reports (admin only)
 */
export async function getVendorReports(limit = 50, offset = 0, status?: string) {
  const where = status ? { status } : {}

  const [reports, total] = await Promise.all([
    prisma.vendorReport.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
            avatar_url: true,
          },
        },
        vendor: {
          select: {
            id: true,
            shop_name: true,
            category: true,
            city: true,
            logo_url: true,
            is_fraud_flagged: true,
            is_suspended: true,
            user: {
              select: {
                is_vendor_verified: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.vendorReport.count({ where }),
  ])

  return {
    reports: reports.map((r: any) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
      reviewed_at: r.reviewed_at?.toISOString(),
    })),
    total,
  }
}

/**
 * Get single vendor report (admin only)
 */
export async function getVendorReport(reportId: string) {
  const report = await prisma.vendorReport.findUnique({
    where: { id: reportId },
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
        },
      },
      vendor: {
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  })

  if (!report) {
    throw { statusCode: 404, message: 'Report not found' }
  }

  return {
    ...report,
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at.toISOString(),
    reviewed_at: report.reviewed_at?.toISOString(),
  }
}

/**
 * Update vendor report status (admin only)
 */
export async function updateVendorReport(
  reportId: string,
  input: UpdateVendorReportInput,
  adminUserId: string
) {
  const { status, admin_notes } = input

  const report = await prisma.vendorReport.update({
    where: { id: reportId },
    data: {
      status,
      admin_notes,
      reviewed_at: new Date(),
      reviewed_by: adminUserId,
    },
    include: {
      vendor: {
        select: {
          user_id: true,
        },
      },
    },
  })

  return {
    id: report.id,
    vendor_id: report.vendor_id,
    user_id: report.user_id,
    reason: report.reason,
    description: report.description,
    status: report.status,
    admin_notes: report.admin_notes,
    reviewed_at: report.reviewed_at?.toISOString(),
    reviewed_by: report.reviewed_by,
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at.toISOString(),
  }
}
