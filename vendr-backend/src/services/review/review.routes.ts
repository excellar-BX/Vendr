import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getReviewsController,
  getMyReviewsController,
  getReviewsReceivedController,
  createReviewController,
  updateReviewController,
  deleteReviewController,
} from './review.controller'

export async function reviewRoutes(app: FastifyInstance) {
  // Public: Get reviews for a vendor
  app.get('/reviews', async (request, reply) => {
    return getReviewsController(request, reply)
  })

  // Protected: Get reviews written by current user
  app.get('/reviews/me', { preHandler: authenticate }, async (request, reply) => {
    return getMyReviewsController(request, reply)
  })

  // Protected: Get reviews received for vendor's store (for vendors)
  app.get('/reviews/received', { preHandler: authenticate }, async (request, reply) => {
    return getReviewsReceivedController(request, reply)
  })

  // Protected: Create review
  app.post('/reviews', { preHandler: authenticate }, async (request, reply) => {
    return createReviewController(request, reply)
  })

  // Protected: Update own review
  app.patch('/reviews/:id', { preHandler: authenticate }, async (request, reply) => {
    return updateReviewController(request, reply)
  })

  // Protected: Delete own review
  app.delete('/reviews/:id', { preHandler: authenticate }, async (request, reply) => {
    return deleteReviewController(request, reply)
  })
}
