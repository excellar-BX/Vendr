import { FastifyRequest, FastifyReply } from 'fastify'
import * as ChatService from './chat.service'
import { createConversationSchema, sendMessageSchema } from './chat.schema'

export async function getConversationsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const conversations = await ChatService.getUserConversations(userId)

    return reply.status(200).send({
      success: true,
      data: conversations,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function getConversationController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    const { conversation, vendor, buyer, actingAsVendor } = await ChatService.getConversation(id, userId)

    // Build response with enriched data
    const result: any = {
      conversation,
      actingAsVendor,
      vendor: actingAsVendor ? null : {
        id: vendor.id,
        business_name: vendor.business_name,
        is_verified: vendor.is_verified,
        user_id: vendor.user_id,
        ...(vendor.user && {
          owner_name: vendor.user.full_name,
          owner_avatar: vendor.user.avatar_url,
        }),
      },
      buyer: actingAsVendor ? {
        id: buyer.id,
        name: buyer.name,
        avatar_url: buyer.avatar_url,
      } : null,
    }

    return reply.status(200).send({
      success: true,
      data: result,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function createConversationController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createConversationSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    })
  }

  try {
    const userId = request.user.id
    const { vendor_id } = parsed.data

    const conversation = await ChatService.getOrCreateConversation(userId, vendor_id)

    return reply.status(201).send({
      success: true,
      data: conversation,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function getMessagesController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const { limit, before } = request.query as {
      limit?: string
      before?: string
    }

    const messages = await ChatService.getConversationMessages(
      id,
      userId,
      limit ? parseInt(limit) : undefined,
      before
    )

    return reply.status(200).send({
      success: true,
      data: messages,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function sendMessageController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = sendMessageSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      errors: parsed.error.flatten().fieldErrors
    })
  }

  try {
    const userId = request.user.id
    const { conversation_id, content, type, image_url, payment_request_id } = parsed.data

    const message = await ChatService.sendMessage(conversation_id, userId, {
      conversation_id,
      content,
      type,
      image_url,
      payment_request_id,
    })

    return reply.status(201).send({
      success: true,
      data: message,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function markDeliveredController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    await ChatService.markMessagesDelivered(id, userId)

    return reply.status(200).send({
      success: true,
      message: 'Messages marked as delivered',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function markAsReadController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    const { messageIds, senderId } = await ChatService.markMessagesAsRead(id, userId)

    // Emit Socket.io event to sender (non-blocking)
    try {
      const { getSocketIO } = require('../../lib/socket')
      const io = getSocketIO()

      if (io && messageIds.length > 0) {
        // Emit to the sender's personal room
        io.to(`user:${senderId}`).emit('messages_read', {
          conversationId: id,
          messageIds,
          readBy: userId,
          timestamp: new Date().toISOString(),
        })

        // Also emit to the conversation room
        io.to(`conversation:${id}`).emit('messages_read', {
          conversationId: id,
          messageIds,
          readBy: userId,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (socketError) {
      console.error('[Chat] Socket.io emit error in markAsRead:', socketError)
    }

    return reply.status(200).send({
      success: true,
      message: 'Messages marked as read',
      data: { messageIds },
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function resetUnreadController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const { field } = request.query as { field: 'buyer_unread' | 'vendor_unread' }

    if (!field) {
      return reply.status(400).send({
        success: false,
        message: 'field query parameter is required (buyer_unread or vendor_unread)'
      })
    }

    await ChatService.resetUnreadCount(id, userId)

    return reply.status(200).send({
      success: true,
      message: 'Unread count reset',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function presenceController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const { is_online } = request.body as { is_online?: boolean }

    await ChatService.updateUserPresence(userId, is_online ?? true)

    // Emit Socket.io event for real-time presence updates (non-blocking)
    try {
      const { getSocketIO } = require('../../lib/socket')
      const io = getSocketIO()

      if (io) {
        // Broadcast to all connected users
        io.emit('user_presence', {
          userId,
          isOnline: is_online ?? true,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (socketError) {
      console.error('[Chat] Socket.io emit error in presence:', socketError)
    }

    return reply.status(200).send({
      success: true,
      message: 'Presence updated',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function getPresenceController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_ids } = request.query as { user_ids?: string }
    const userIds = user_ids?.split(',').filter(Boolean) || []

    const presence = await ChatService.getUserPresence(userIds)

    return reply.status(200).send({
      success: true,
      data: presence,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function createPaymentRequestController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const { conversation_id, amount, description } = request.body as {
      conversation_id: string
      amount: number
      description?: string
    }

    if (!conversation_id || !amount) {
      return reply.status(400).send({
        success: false,
        message: 'conversation_id and amount are required',
      })
    }

    const result = await ChatService.createPaymentRequest(conversation_id, userId, amount, description)

    return reply.status(201).send({
      success: true,
      data: result,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function payPaymentRequestController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const { id } = request.params as { id: string }

    const result = await ChatService.payPaymentRequest(id, userId)

    return reply.status(200).send({
      success: true,
      data: result,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function cancelPaymentRequestController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const { id } = request.params as { id: string }

    await ChatService.cancelPaymentRequest(id, userId)

    return reply.status(200).send({
      success: true,
      message: 'Payment request cancelled',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function updateMessageController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const { content } = request.body as { content: string }

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({
        success: false,
        message: 'Content is required',
      })
    }

    const message = await ChatService.updateMessage(id, userId, content)

    return reply.status(200).send({
      success: true,
      data: message,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function deleteMessageController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    await ChatService.deleteMessage(id, userId)

    return reply.status(200).send({
      success: true,
      message: 'Message deleted',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}
