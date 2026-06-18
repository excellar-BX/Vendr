import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getVendorAnalyticsController,
  recordProfileViewController,
  recordProductViewController,
  recordInquiryController,
  recordOrderController,
  getProductAnalyticsController,
} from './vendor-analytics.controller'

export async function vendorAnalyticsRoutes(app: FastifyInstance) {
  // Protected: Get analytics for a vendor (vendor only)
  app.get(
    '/vendors/:vendorId/analytics',
    { preHandler: authenticate },
    getVendorAnalyticsController
  )

  // Public: Record a profile view
  app.post(
    '/vendors/:vendorId/analytics/profile-view',
    recordProfileViewController
  )

  // Public: Record a product view
  app.post(
    '/products/:productId/analytics/view',
    recordProductViewController
  )

  // Internal: Record an inquiry
  app.post(
    '/vendors/:vendorId/analytics/inquiry',
    { preHandler: authenticate },
    recordInquiryController
  )

  // Internal: Record an order
  app.post(
    '/vendors/analytics/order',
    { preHandler: authenticate },
    recordOrderController
  )

  // Protected: Get product-specific analytics
  app.get(
    '/vendors/:vendorId/products/:productId/analytics',
    { preHandler: authenticate },
    getProductAnalyticsController
  )
}