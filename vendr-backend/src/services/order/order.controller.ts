import { FastifyRequest, FastifyReply } from 'fastify'
import * as OrderService from './order.service'

export async function getOrdersController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const { type } = request.query as { type?: 'bought' | 'sold' }

    if (!type || type === 'bought') {
      // Default: get bought orders (where user is buyer)
      const orders = await OrderService.getBoughtOrders(userId)
      return reply.status(200).send({ success: true, data: orders })
    } else if (type === 'sold') {
      // Get sold orders (where user is vendor)
      const orders = await OrderService.getSoldOrders(userId)
      return reply.status(200).send({ success: true, data: orders })
    } else {
      // Invalid type - return empty
      return reply.status(200).send({ success: true, data: [] })
    }
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getOrdersStatsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const stats = await OrderService.getOrdersStats(userId)
    return reply.status(200).send({ success: true, data: stats })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
