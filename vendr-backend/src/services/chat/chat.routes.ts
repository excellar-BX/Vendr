import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getConversationsController,
  getConversationController,
  createConversationController,
  getMessagesController,
  getMessageController,
  sendMessageController,
  updateMessageController,
  deleteMessageController,
  addReactionController,
  removeReactionController,
  markDeliveredController,
  markAsReadController,
  resetUnreadController,
  presenceController,
  getPresenceController,
  createPaymentRequestController,
  payPaymentRequestController,
  cancelPaymentRequestController,
} from './chat.controller'

export async function chatRoutes(app: FastifyInstance) {
  // All chat routes require authentication
  const authOptions = { preHandler: authenticate }

  // Conversations
  app.get('/conversations', authOptions, async (request, reply) => {
    return getConversationsController(request, reply)
  })

  app.get('/conversations/:id', authOptions, async (request, reply) => {
    return getConversationController(request, reply)
  })

  app.post('/conversations', authOptions, async (request, reply) => {
    return createConversationController(request, reply)
  })

  // Messages
  app.get('/conversations/:id/messages', authOptions, async (request, reply) => {
    return getMessagesController(request, reply)
  })

  app.get('/messages/:id', authOptions, async (request, reply) => {
    return getMessageController(request, reply)
  })

  app.post('/messages', authOptions, async (request, reply) => {
    return sendMessageController(request, reply)
  })

  app.patch('/messages/:id', authOptions, async (request, reply) => {
    return updateMessageController(request, reply)
  })

  app.delete('/messages/:id', authOptions, async (request, reply) => {
    return deleteMessageController(request, reply)
  })

  app.post('/messages/:id/reactions', authOptions, async (request, reply) => {
    return addReactionController(request, reply)
  })

  app.delete('/messages/:id/reactions', authOptions, async (request, reply) => {
    return removeReactionController(request, reply)
  })

  // Payment Requests
  app.post('/conversations/:id/payment-requests', authOptions, async (request, reply) => {
    return createPaymentRequestController(request, reply)
  })

  app.post('/payment-requests/:id/pay', authOptions, async (request, reply) => {
    return payPaymentRequestController(request, reply)
  })

  app.delete('/payment-requests/:id', authOptions, async (request, reply) => {
    return cancelPaymentRequestController(request, reply)
  })

  // Mark as delivered/read
  app.patch('/conversations/:id/mark-delivered', authOptions, async (request, reply) => {
    return markDeliveredController(request, reply)
  })

  app.patch('/conversations/:id/mark-read', authOptions, async (request, reply) => {
    return markAsReadController(request, reply)
  })

  app.patch('/conversations/:id/reset-unread', authOptions, async (request, reply) => {
    return resetUnreadController(request, reply)
  })

  // Presence
  app.post('/presence', authOptions, async (request, reply) => {
    return presenceController(request, reply)
  })

  app.get('/presence', authOptions, async (request, reply) => {
    return getPresenceController(request, reply)
  })
}
