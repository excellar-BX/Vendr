import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  submitVendorReportController,
  checkReportedController,
  getVendorReportsController,
  getVendorReportController,
  updateVendorReportController,
} from './vendor-report.controller'

export async function vendorReportRoutes(app: FastifyInstance) {
  // Protected: Submit vendor report (buyer action)
  app.post('/vendor-reports', { preHandler: authenticate }, async (request, reply) => {
    return submitVendorReportController(request, reply)
  })

  // Protected: Check if user has reported a vendor
  app.get('/vendor-reports/:vendorId/check', { preHandler: authenticate }, async (request, reply) => {
    return checkReportedController(request, reply)
  })

  // Admin only: Get all vendor reports
  app.get('/admin/vendor-reports', { preHandler: authenticate }, async (request, reply) => {
    return getVendorReportsController(request, reply)
  })

  // Admin only: Get single vendor report
  app.get('/admin/vendor-reports/:reportId', { preHandler: authenticate }, async (request, reply) => {
    return getVendorReportController(request, reply)
  })

  // Admin only: Update vendor report status
  app.patch('/admin/vendor-reports/:reportId', { preHandler: authenticate }, async (request, reply) => {
    return updateVendorReportController(request, reply)
  })
}
