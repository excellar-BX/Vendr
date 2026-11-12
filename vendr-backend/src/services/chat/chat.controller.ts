//vendr-backend/src/services/chat/chat.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import * as ChatService from './chat.service'
import { createConversationSchema, sendMessageSchema, addReactionSchema } from './chat.schema'

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

    // The service already shapes vendor/buyer for the client; only expose the other party
    const result: any = {
      conversation,
      actingAsVendor,
      vendor: actingAsVendor ? null : vendor && {
        ...vendor,
        avatar_url: vendor.owner_avatar ?? null,
      },
      buyer: actingAsVendor ? buyer : null,
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

export async function getMessageController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    const message = await ChatService.getMessage(id, userId)

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
    const { conversation_id, content, type, image_url, payment_request_id, reply_to_id, client_id } = parsed.data

    const message = await ChatService.sendMessage(conversation_id, userId, {
      conversation_id,
      content,
      type,
      image_url,
      payment_request_id,
      reply_to_id,
      client_id,
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

    const { messageIds } = await ChatService.markMessagesAsRead(id, userId)

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
    // The counter to reset is derived from the caller's role in the conversation;
    // the legacy `field` query param is accepted but ignored.
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

    // Persists + notifies the user's contacts over the socket
    await ChatService.updateUserPresence(userId, is_online ?? true)

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
    const { conversation_id, amount, description, is_delivery, delivery_address, delivery_lat, delivery_lng, delivery_fee } = request.body as {
      conversation_id: string
      amount: number
      description?: string
      is_delivery?: boolean
      delivery_address?: string
      delivery_lat?: number
      delivery_lng?: number
      delivery_fee?: number
    }

    if (!conversation_id || !amount) {
      return reply.status(400).send({
        success: false,
        message: 'conversation_id and amount are required',
      })
    }

    if (is_delivery && (!delivery_address || !delivery_lat || !delivery_lng)) {
      return reply.status(400).send({
        success: false,
        message: 'delivery_address, delivery_lat, and delivery_lng are required for delivery orders',
      })
    }

    const result = await ChatService.createPaymentRequest(
      conversation_id,
      userId,
      amount,
      description,
      is_delivery,
      delivery_address,
      delivery_lat,
      delivery_lng,
      delivery_fee
    )

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
    const { order_type, delivery_address } = (request.body ?? {}) as {
      order_type?: 'pickup' | 'delivery'
      delivery_address?: string
    }

    const result = await ChatService.payPaymentRequest(id, userId, {
      order_type,
      delivery_address,
    })

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
    const { content } = (request.body ?? {}) as { content?: string }

    if (!content || typeof content !== 'string' || !content.trim()) {
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

export async function addReactionController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const parsed = addReactionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Unsupported reaction',
      })
    }
    const { emoji } = parsed.data

    const reaction = await ChatService.addReaction(id, userId, emoji)

    return reply.status(201).send({
      success: true,
      data: reaction,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}

export async function removeReactionController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id

    await ChatService.removeReaction(id, userId)

    return reply.status(200).send({
      success: true,
      message: 'Reaction removed',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message
    })
  }
}
