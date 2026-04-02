import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getOrdersController,
  getOrdersStatsController
} from './order.controller'

export async function orderRoutes(app: FastifyInstance) {
  // Protected: Get user's orders (bought or sold)
  // GET /orders/me?type=bought|sold (type defaults to 'bought')
  app.get('/orders/me', { preHandler: authenticate }, getOrdersController)

  // Protected: Get order statistics (counts)
  app.get('/orders/me/stats', { preHandler: authenticate }, getOrdersStatsController)
}
