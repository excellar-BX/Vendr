import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getOrdersController,
  getOrdersStatsController,
  updateOrderStatusController,
  confirmOrderReceiptController
} from './order.controller'

export async function orderRoutes(app: FastifyInstance) {
  // Protected: Get user's orders (bought or sold)
  // GET /orders/me?type=bought|sold (type defaults to 'bought')
  app.get('/orders/me', { preHandler: authenticate }, getOrdersController)

  // Protected: Get order statistics (counts)
  app.get('/orders/me/stats', { preHandler: authenticate }, getOrdersStatsController)

  // Protected: Update order status (vendor only)
  // PATCH /orders/:orderId/status
  app.patch('/orders/:orderId/status', { preHandler: authenticate }, updateOrderStatusController)

  // Protected: Confirm order receipt (buyer only)
  // POST /orders/:orderId/confirm
  app.post('/orders/:orderId/confirm', { preHandler: authenticate }, confirmOrderReceiptController)
}
