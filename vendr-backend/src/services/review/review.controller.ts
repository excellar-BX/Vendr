import { FastifyRequest, FastifyReply } from 'fastify'
import * as ReviewService from './review.service'
import { createReviewSchema, updateReviewSchema } from './review.schema'

export async function getReviewsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendor_id } = request.query as { vendor_id?: string }

    if (!vendor_id) {
      return reply.status(400).send({ success: false, message: 'vendor_id is required' })
    }

    const reviews = await ReviewService.getReviewsByVendor(vendor_id)
    return reply.status(200).send({ success: true, data: reviews })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getMyReviewsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const reviews = await ReviewService.getReviewsByUser(userId)
    return reply.status(200).send({ success: true, data: reviews })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function createReviewController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createReviewSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const userId = request.user.id
    const review = await ReviewService.createReview(userId, parsed.data)
    return reply.status(201).send({ success: true, data: review })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function updateReviewController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateReviewSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const review = await ReviewService.updateReview(id, userId, parsed.data)
    return reply.status(200).send({ success: true, data: review })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function deleteReviewController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    await ReviewService.deleteReview(id, userId)
    return reply.status(200).send({ success: true, message: 'Review deleted' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
