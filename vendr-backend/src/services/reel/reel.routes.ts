import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getReelsController,
  createReelController,
  getReelController,
  deleteReelController,
  incrementViewController,
  getSavedReelsController,
} from './reel.controller'

export async function reelRoutes(app: FastifyInstance) {
  // Public: Get reels by vendor_id (only active reels)
  // Authenticated: vendor can see all their reels with include_all=true
  app.get('/reels', async (request, reply) => {
    return getReelsController(request, reply)
  })

  // Protected: Create reel
  app.post('/reels', { preHandler: authenticate }, async (request, reply) => {
    return createReelController(request, reply)
  })

  // Public: Get single reel
  app.get('/reels/:id', async (request, reply) => {
    return getReelController(request, reply)
  })

  // Protected: Increment view count
  app.post('/reels/:id/view', { preHandler: authenticate }, async (request, reply) => {
    return incrementViewController(request, reply)
  })

  // Protected: Delete reel
  app.delete('/reels/:id', { preHandler: authenticate }, async (request, reply) => {
    return deleteReelController(request, reply)
  })

  // Protected: Get saved reels for current user
  app.get('/reels/saved', { preHandler: authenticate }, async (request, reply) => {
    return getSavedReelsController(request, reply)
  })
}
