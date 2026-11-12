//search.routes.ts
import { FastifyInstance } from 'fastify'
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate'
import {
  searchController,
  suggestionsController,
  searchHistoryController,
  saveSearchHistoryController,
  clearSearchHistoryController,
} from './search.controller'

export async function searchRoutes(app: FastifyInstance) {
  // Public: Search vendors, products and reels
  // Supports filters: q, category, verified_only, min_rating, lat, lng, max_distance, limit, offset
  app.get('/search', async (request, reply) => {
    return searchController(request, reply)
  })

  // Public (optionally authenticated): suggestions for the type-ahead dropdown.
  // When a valid token is sent, the user's own matching history is included.
  app.get('/search/suggestions', { preHandler: optionalAuthenticate }, async (request, reply) => {
    return suggestionsController(request, reply)
  })

  // Protected: Get user's search history
  app.get('/search/history', { preHandler: authenticate }, async (request, reply) => {
    return searchHistoryController(request, reply)
  })

  // Protected: Save search query to history
  app.post('/search/history', { preHandler: authenticate }, async (request, reply) => {
    return saveSearchHistoryController(request, reply)
  })

  // Protected: Clear all search history, or a single entry via ?query=
  app.delete('/search/history', { preHandler: authenticate }, async (request, reply) => {
    return clearSearchHistoryController(request, reply)
  })
}
