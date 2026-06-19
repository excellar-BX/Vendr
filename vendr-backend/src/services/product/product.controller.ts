import { FastifyRequest, FastifyReply } from 'fastify'
import * as ProductService from './product.service'
import { createProductSchema, updateProductSchema } from './product.schema'
import * as VendorAnalyticsService from '../vendor-analytics/vendor-analytics.service'

export async function getProductsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendor_id } = request.query as { vendor_id?: string }
    const { include_all } = request.query as { include_all?: string }

    if (!vendor_id) {
      return reply.status(400).send({ success: false, message: 'vendor_id is required' })
    }

    const products = await ProductService.getProductsByVendor(vendor_id, include_all === 'true')
    return reply.status(200).send({ success: true, data: products })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function createProductController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createProductSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const userId = request.user.id
    const product = await ProductService.createProduct(userId, parsed.data)
    return reply.status(201).send({ success: true, data: product })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getProductController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const product = await ProductService.getProductById(id, request.user?.id)
    
    // Record product view analytics (fire and forget, don't block response)
    const userId = request.user?.id
    VendorAnalyticsService.recordProductView(id, product.vendor_id, userId).catch(err => {
      console.error('[Analytics] Failed to record product view:', err);
    });
    
    return reply.status(200).send({ success: true, data: product })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function updateProductController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateProductSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const product = await ProductService.updateProduct(id, userId, parsed.data)
    return reply.status(200).send({ success: true, data: product })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function deleteProductController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    await ProductService.deleteProduct(id, userId)
    return reply.status(200).send({ success: true, message: 'Product deleted' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
