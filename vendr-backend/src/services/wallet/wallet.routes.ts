import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getWalletBalance,
  processPayment
} from './wallet.service'
import {
  getWalletBalance as getWalletBalanceController,
  getOrCreateVirtualAccount,
  getVirtualAccount,
  getTransactions,
  getBanks,
  validateAccount,
  withdrawToBank,
  addBankAccount,
  getBankAccounts,
  deleteBankAccount,
  setDefaultBankAccount,
  processWebhook,
  processDisbursementWebhook,
  pollPendingWithdrawals,
} from './wallet.controller'

export async function walletRoutes(app: FastifyInstance) {
  // Get current user's wallet balance
  app.get('/wallet/balance', { preHandler: authenticate }, getWalletBalanceController)

  // Get or create virtual account
  app.post('/wallet/virtual-account', { preHandler: authenticate }, getOrCreateVirtualAccount)

  // Get virtual account
  app.get('/wallet/virtual-account', { preHandler: authenticate }, getVirtualAccount)

  // Get transaction history
  app.get('/wallet/transactions', { preHandler: authenticate }, getTransactions)

  // Get list of supported banks
  app.get('/wallet/banks', { preHandler: authenticate }, getBanks)

  // Validate bank account
  app.get('/wallet/validate-account', { preHandler: authenticate }, validateAccount)

  // Withdraw to bank
  app.post('/wallet/withdraw', { preHandler: authenticate }, withdrawToBank)

  // Add bank account
  app.post('/wallet/bank-accounts', { preHandler: authenticate }, addBankAccount)

  // Get bank accounts
  app.get('/wallet/bank-accounts', { preHandler: authenticate }, getBankAccounts)

  // Delete bank account
  app.delete('/wallet/bank-accounts/:id', { preHandler: authenticate }, deleteBankAccount)

  // Set default bank account
  app.put('/wallet/bank-accounts/:id/default', { preHandler: authenticate }, setDefaultBankAccount)

  // Process Monnify webhook (no auth required)
  app.post('/wallet/webhook/monnify', processWebhook)

  // Process Monnify disbursement webhook (no auth required)
  app.post('/wallet/webhook/monnify/disbursement', processDisbursementWebhook)

  // Poll pending withdrawals (for manual testing or cron job)
  app.post('/wallet/poll-withdrawals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await pollPendingWithdrawals();
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: err.message });
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
