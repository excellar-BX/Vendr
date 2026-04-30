import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  submitVendorReportController,
  checkReportedController,
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

  // Admin routes for vendor reports are now in admin.routes.ts
  // to keep all admin endpoints in one place
}
