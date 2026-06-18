import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../../lib/prisma'
import * as VendorAnalyticsService from './vendor-analytics.service'
import { getAnalyticsSchema, getProductAnalyticsSchema } from './vendor-analytics.schema'

/**
 * Get analytics for a vendor (vendor only)
 */
export async function getVendorAnalyticsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { vendorId } = request.params as { vendorId: string }
    const { period } = request.query as { period?: 'day' | 'week' | 'month' | 'all' }

    // Verify the user owns this vendor
    const userId = request.user.id
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, user_id: userId },
    })

    if (!vendor) {
      return reply.status(403).send({ success: false, message: 'Access denied' })
    }

    const parsed = getAnalyticsSchema.safeParse({ period: period || 'all' })
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ success: false, errors: parsed.error.flatten().fieldErrors })
    }

    const analytics = await VendorAnalyticsService.getVendorAnalytics(
      vendorId,
      parsed.data.period
    )
    return reply.status(200).send({ success: true, data: analytics })
  } catch (err: any) {
    request.log.error(err, 'getVendorAnalyticsController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}

/**
 * Record a profile view (public endpoint)
 */
export async function recordProfileViewController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { vendorId } = request.params as { vendorId: string }
    const userId = (request.user as any)?.id // Optional - unauthenticated ok

    await VendorAnalyticsService.recordProfileView(vendorId, userId)
    return reply.status(200).send({ success: true })
  } catch (err: any) {
    request.log.error(err, 'recordProfileViewController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}

/**
 * Record a product view (public endpoint)
 */
export async function recordProductViewController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { productId } = request.params as { productId: string }
    const userId = (request.user as any)?.id // Optional

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { vendor_id: true },
    })

    if (!product) {
      return reply.status(404).send({ success: false, message: 'Product not found' })
    }

    await VendorAnalyticsService.recordProductView(productId, product.vendor_id, userId)
    return reply.status(200).send({ success: true })
  } catch (err: any) {
    request.log.error(err, 'recordProductViewController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}

/**
 * Record an inquiry/conversation
 */
export async function recordInquiryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { vendorId } = request.params as { vendorId: string }

    await VendorAnalyticsService.recordInquiry(vendorId)
    return reply.status(200).send({ success: true })
  } catch (err: any) {
    request.log.error(err, 'recordInquiryController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}

/**
 * Record an order
 */
export async function recordOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { vendorId, productId, amount } = request.body as {
      vendorId: string
      productId: string
      amount: number
    }

    await VendorAnalyticsService.recordOrder(vendorId, productId, amount)
    return reply.status(200).send({ success: true })
  } catch (err: any) {
    request.log.error(err, 'recordOrderController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}

/**
 * Get product-specific analytics (vendor only)
 */
export async function getProductAnalyticsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { vendorId, productId } = request.params as {
      vendorId: string
      productId: string
    }
    const { period } = request.query as { period?: 'day' | 'week' | 'month' | 'all' }

    // Verify the user owns this vendor
    const userId = request.user.id
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, user_id: userId },
    })

    if (!vendor) {
      return reply.status(403).send({ success: false, message: 'Access denied' })
    }

    const parsed = getProductAnalyticsSchema.safeParse({
      product_id: productId,
      period: period || 'all',
    })
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ success: false, errors: parsed.error.flatten().fieldErrors })
    }

    const analytics = await VendorAnalyticsService.getProductAnalytics(
      vendorId,
      productId,
      parsed.data.period
    )
    return reply.status(200).send({ success: true, data: analytics })
  } catch (err: any) {
    request.log.error(err, 'getProductAnalyticsController error')
    return reply
      .status(err.statusCode ?? 500)
      .send({ success: false, message: err.message ?? 'Internal server error' })
  }
}