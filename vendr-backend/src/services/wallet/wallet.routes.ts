import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { getWalletBalance, processPayment } from './wallet.service'

export async function walletRoutes(app: FastifyInstance) {
  // Get current user's wallet balance
  app.get('/wallet/balance', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = request.user.id
      const balance = await getWalletBalance(userId)
      return reply.status(200).send({ success: true, data: balance })
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
    }
  })

  // Process payment (transfer funds between wallets)
  app.post('/wallet/pay', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = request.user.id
      const { vendor_id, amount, payment_request_id, description } = request.body as {
        vendor_id: string
        amount: number
        payment_request_id?: string
        description?: string
      }

      if (!vendor_id || !amount) {
        return reply.status(400).send({
          success: false,
          message: 'vendor_id and amount are required',
        })
      }

      const result = await processPayment(
        userId, // buyer
        vendor_id,
        amount,
        payment_request_id || '',
        description
      )

      return reply.status(200).send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
    }
  })
}
