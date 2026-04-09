import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getReelsController,
  createReelController,
  getReelController,
  deleteReelController,
  incrementViewController,
  getSavedReelsController,
  toggleLikeController,
  toggleSaveController,
} from './reel.controller'

export async function reelRoutes(app: FastifyInstance) {
  // GET /reels - Fetch reels
  // - Without vendor_id: returns main feed (all active reels)
  // - With vendor_id: returns reels for that vendor
  // Optional query: include_all=true (vendor only, shows inactive)
  // Auth optional: if provided, includes user's like/save status
  app.get('/reels', async (request, reply) => {
    return getReelsController(request, reply)
  })

  // POST /reels - Create new reel (authenticated)
  app.post('/reels', { preHandler: authenticate }, async (request, reply) => {
    return createReelController(request, reply)
  })

  // GET /reels/:id - Get single reel (enriched)
  app.get('/reels/:id', async (request, reply) => {
    return getReelController(request, reply)
  })

  // POST /reels/:id/view - Increment view count (authenticated)
  app.post('/reels/:id/view', { preHandler: authenticate }, async (request, reply) => {
    return incrementViewController(request, reply)
  })

  // POST /reels/:id/like - Toggle like (authenticated)
  app.post('/reels/:id/like', { preHandler: authenticate }, async (request, reply) => {
    return toggleLikeController(request, reply)
  })

  // POST /reels/:id/save - Toggle save (authenticated)
  app.post('/reels/:id/save', { preHandler: authenticate }, async (request, reply) => {
    return toggleSaveController(request, reply)
  })

  // DELETE /reels/:id - Delete reel (authenticated, vendor only)
  app.delete('/reels/:id', { preHandler: authenticate }, async (request, reply) => {
    return deleteReelController(request, reply)
  })

  // GET /reels/saved - Get saved reels for current user (authenticated)
  app.get('/reels/saved', { preHandler: authenticate }, async (request, reply) => {
    return getSavedReelsController(request, reply)
  })
}
