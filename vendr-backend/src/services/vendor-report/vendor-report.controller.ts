import { FastifyRequest, FastifyReply } from 'fastify'
import * as VendorReportService from './vendor-report.service'
import { vendorReportSchema, updateVendorReportSchema } from './vendor-report.schema'

/**
 * Submit a vendor report (buyer action)
 */
export async function submitVendorReportController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = vendorReportSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const userId = request.user.id
    const report = await VendorReportService.submitVendorReport(userId, parsed.data)
    return reply.status(201).send({ success: true, data: report })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

/**
 * Check if user has reported a vendor
 */
export async function checkReportedController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendorId } = request.params as { vendorId: string }
    const userId = request.user.id
    const hasReported = await VendorReportService.hasUserReportedVendor(userId, vendorId)
    return reply.status(200).send({ success: true, data: { has_reported: hasReported } })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

/**
 * Get all vendor reports (admin only)
 */
export async function getVendorReportsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { limit, offset, status } = request.query as {
      limit?: string
      offset?: string
      status?: string
    }
    const result = await VendorReportService.getVendorReports(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
      status
    )
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

/**
 * Get single vendor report (admin only)
 */
export async function getVendorReportController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { reportId } = request.params as { reportId: string }
    const report = await VendorReportService.getVendorReport(reportId)
    return reply.status(200).send({ success: true, data: report })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

/**
 * Update vendor report status (admin only)
 */
export async function updateVendorReportController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateVendorReportSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const { reportId } = request.params as { reportId: string }
    const adminUserId = request.user.id
    const report = await VendorReportService.updateVendorReport(reportId, parsed.data, adminUserId)
    return reply.status(200).send({ success: true, data: report })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
