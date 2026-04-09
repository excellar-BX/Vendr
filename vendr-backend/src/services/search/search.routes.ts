//search.routes.ts
import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  searchController,
  suggestionsController,
  searchHistoryController,
  saveSearchHistoryController,
  clearSearchHistoryController,
} from './search.controller'

export async function searchRoutes(app: FastifyInstance) {
  // Public: Search vendors and products
  // Supports filters: q, category, verified_only, min_rating, lat, lng, limit, offset
  app.get('/search', async (request, reply) => {
    return searchController(request, reply)
  })

  // Public: Get search suggestions (for dropdown)
  // Lightweight endpoint for debounced suggestions
  app.get('/search/suggestions', async (request, reply) => {
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

  // Protected: Clear search history
  app.delete('/search/history', { preHandler: authenticate }, async (request, reply) => {
    return clearSearchHistoryController(request, reply)
  })
}
