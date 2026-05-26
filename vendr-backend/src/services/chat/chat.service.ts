import prisma from '../../lib/prisma'
import * as WalletService from '../wallet/wallet.service'
import type {
  CreateConversationInput,
  ConversationOutput,
  SendMessageInput,
  MessageOutput,
  ConversationListItem,
  EnrichedConversation,
} from './chat.schema'

// Socket.io import for real-time events
const { getSocketIO } = require('../../lib/socket')

// Notification service
const { createNotification } = require('../notification/notification.service')

/**
 * Check if user is trying to chat with themselves
 */
async function isSelfChat(buyerId: string, vendorId: string): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { user_id: true }
  })
  return vendor?.user_id === buyerId
}

/**
 * Get or create conversation between buyer and vendor
 * Ensures user cannot create conversation with themselves
 */
export async function getOrCreateConversation(
  buyerId: string,
  vendorId: string
): Promise<ConversationOutput> {
  // Check if vendor exists
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, user_id: true, is_active: true }
  })

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found' }
  }

  if (!vendor.is_active) {
    throw { statusCode: 400, message: 'This vendor is no longer active' }
  }

  // CRITICAL: Prevent self-chat
  if (vendor.user_id === buyerId) {
    throw { statusCode: 403, message: 'You cannot chat with your own store' }
  }

  // Check if conversation already exists
  const existing = await prisma.conversation.findUnique({
    where: {
      buyer_id_vendor_id: {
        buyer_id: buyerId,
        vendor_id: vendorId,
      }
    }
  })

  if (existing) {
    return {
      id: existing.id,
      buyer_id: existing.buyer_id,
      vendor_id: existing.vendor_id,
      last_message: existing.last_message,
      last_message_at: existing.last_message_at.toISOString(),
      buyer_unread: existing.buyer_unread,
      vendor_unread: existing.vendor_unread,
      created_at: existing.created_at.toISOString(),
    }
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      buyer_id: buyerId,
      vendor_id: vendorId,
      last_message: null,
      last_message_at: new Date(),
      buyer_unread: 0,
      vendor_unread: 0,
    }
  })

  return {
    id: conversation.id,
    buyer_id: conversation.buyer_id,
    vendor_id: conversation.vendor_id,
    last_message: conversation.last_message,
    last_message_at: conversation.last_message_at.toISOString(),
    buyer_unread: conversation.buyer_unread,
    vendor_unread: conversation.vendor_unread,
    created_at: conversation.created_at.toISOString(),
  }
}

/**
 * Get conversation by ID with full details
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<{ conversation: ConversationOutput; vendor: any; buyer: any; actingAsVendor: boolean }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      vendor: {
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
              is_vendor_verified: true,
            }
          }
        }
      },
      buyer: {
        select: {
          id: true,
          full_name: true,
          avatar_url: true,
        }
      }
    }
  })

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found' }
  }

  // Check if user is participant
  const isBuyer = conversation.buyer_id === userId
  const actingAsVendor = conversation.vendor.user_id === userId

  if (!isBuyer && !actingAsVendor) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // Transform vendor to match mobile expectations
  const vendorOutput = conversation.vendor ? {
    id: conversation.vendor.id,
    business_name: conversation.vendor.shop_name, // alias
    is_verified: conversation.vendor.user?.is_vendor_verified,
    user_id: conversation.vendor.user_id,
    ...(conversation.vendor.user && {
      owner_name: conversation.vendor.user.full_name,
      owner_avatar: conversation.vendor.user.avatar_url,
    }),
  } : null

  const buyerOutput = conversation.buyer ? {
    id: conversation.buyer.id,
    name: conversation.buyer.full_name,
    avatar_url: conversation.buyer.avatar_url,
  } : null

  return {
    conversation: {
      id: conversation.id,
      buyer_id: conversation.buyer_id,
      vendor_id: conversation.vendor_id,
      last_message: conversation.last_message,
      last_message_at: conversation.last_message_at.toISOString(),
      buyer_unread: conversation.buyer_unread,
      vendor_unread: conversation.vendor_unread,
      created_at: conversation.created_at.toISOString(),
    },
    vendor: vendorOutput,
    buyer: buyerOutput,
    actingAsVendor,
  }
}

/**
 * Get all conversations for a user (as buyer or vendor)
 * Returns enriched conversation list with all needed data
 */
export async function getUserConversations(userId: string): Promise<any[]> {
  // Get vendor IDs owned by user
  const myVendors = await prisma.vendor.findMany({
    where: { user_id: userId },
    select: { id: true, user_id: true }
  })
  const myVendorIds = myVendors.map(v => v.id)

  // Fetch conversations where user is buyer OR vendor owner
  const [buyerConvs, vendorConvs] = await Promise.all([
    prisma.conversation.findMany({
      where: { buyer_id: userId },
      include: {
        vendor: {
          select: {
            id: true,
            shop_name: true,
            user_id: true,
            user: {
              select: {
                is_vendor_verified: true,
              },
            },
          },
        },
      },
      orderBy: { last_message_at: 'desc' },
    }),
    myVendorIds.length > 0
      ? prisma.conversation.findMany({
          where: { vendor_id: { in: myVendorIds } },
          include: {
            buyer: {
              select: {
                id: true,
                full_name: true,
                avatar_url: true,
              }
            }
          },
          orderBy: { last_message_at: 'desc' },
        })
      : Promise.resolve([])
  ])

  // Build merged list first
  const buyerList: any[] = buyerConvs.map(c => ({
    id: c.id,
    buyer_id: c.buyer_id,
    vendor_id: c.vendor_id,
    last_message: c.last_message,
    last_message_at: c.last_message_at.toISOString(),
    buyer_unread: c.buyer_unread,
    vendor_unread: c.vendor_unread,
    vendor: c.vendor ? {
      id: c.vendor.id,
      business_name: c.vendor.shop_name, // alias
      is_verified: c.vendor.user?.is_vendor_verified,
      user_id: c.vendor.user_id,
    } : null,
    buyer: null,
    iAmVendor: false,
  }))

  const vendorList: any[] = vendorConvs.map(c => ({
    id: c.id,
    buyer_id: c.buyer_id,
    vendor_id: c.vendor_id,
    last_message: c.last_message,
    last_message_at: c.last_message_at.toISOString(),
    buyer_unread: c.buyer_unread,
    vendor_unread: c.vendor_unread,
    vendor: null,
    buyer: c.buyer ? {
      id: c.buyer.id,
      name: c.buyer.full_name,
      avatar_url: c.buyer.avatar_url,
    } : null,
    iAmVendor: true,
  }))

  // Merge and deduplicate, but keep vendor version if appears in both (vendor takes precedence for iAmVendor)
  const allConvs = [...vendorList, ...buyerList]
  const seenIds = new Set<string>()
  const unique: any[] = []

  for (const conv of allConvs) {
    if (!seenIds.has(conv.id)) {
      seenIds.add(conv.id)
      // If it's a buyerView and we also have a vendorView, skip buyerView (vendor already added first)
      unique.push(conv)
    } else {
      // Already exists from other perspective - merge iAmVendor flag
      const existing = unique.find(c => c.id === conv.id)
      if (existing) {
        existing.iAmVendor = existing.iAmVendor || conv.iAmVendor
      }
    }
  }

  // Now enrich with presence and last message details
  if (unique.length === 0) return unique

  // Get all other user IDs for presence
  const otherUserIds = unique.map(c =>
    c.iAmVendor ? c.buyer_id : c.vendor?.user_id
  ).filter(Boolean) as string[]

  const presenceMap = await getUserPresence(otherUserIds)

  // Get last message for each conversation
  const lastMsgs = await prisma.message.findMany({
    where: { conversation_id: { in: unique.map(c => c.id) } },
    orderBy: { created_at: 'desc' },
  })

  const lastMsgMap: Record<string, any> = {}
  lastMsgs.forEach(m => {
    if (!lastMsgMap[m.conversation_id]) {
      lastMsgMap[m.conversation_id] = m
    }
  })

  // Combine all data
  return unique.map(c => {
    const otherUserId = c.iAmVendor ? c.buyer_id : c.vendor?.user_id
    const lastMsg = lastMsgMap[c.id]

    return {
      ...c,
      other_online: presenceMap[otherUserId] ?? false,
      last_message_mine: lastMsg?.sender_id === userId,
      last_message_delivered: lastMsg?.delivered ?? false,
      last_message_read: lastMsg?.is_read ?? false,
    }
  })
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit?: number,
  before?: string
): Promise<MessageOutput[]> {
  // First verify access
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { buyer_id: true, vendor_id: true }
  })

  if (!conv) {
    throw { statusCode: 404, message: 'Conversation not found' }
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: conv.vendor_id },
    select: { user_id: true }
  })

  const isBuyer = conv.buyer_id === userId
  const isVendor = vendor?.user_id === userId

  if (!isBuyer && !isVendor) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // Build query
  const where: any = { conversation_id: conversationId }
  if (before) {
    where.created_at = { lt: new Date(before) }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { created_at: 'asc' },
    take: limit ?? 100,
  })

  // Fetch payment request details for payment_request type messages
  const paymentRequestIds = messages
    .filter(m => m.type === 'payment_request' && m.content)
    .map(m => m.content!)
    .filter(Boolean)

  const paymentRequestsMap: Record<string, any> = {}
  if (paymentRequestIds.length > 0) {
    const paymentRequests = await prisma.paymentRequest.findMany({
      where: { id: { in: paymentRequestIds } },
    })
    paymentRequests.forEach(pr => {
      paymentRequestsMap[pr.id] = {
        id: pr.id,
        vendor_id: pr.vendor_id,
        buyer_id: pr.buyer_id,
        conversation_id: pr.conversation_id,
        amount: pr.amount,
        description: pr.description,
        status: pr.status,
        paid_at: pr.paid_at?.toISOString() ?? null,
        created_at: pr.created_at.toISOString(),
      }
    })
  }

  return messages.map(m => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.content,
    image_url: m.image_url,
    type: m.type as 'text' | 'image' | 'payment_request',
    is_read: m.is_read,
    delivered: m.delivered,
    edited: m.edited,
    created_at: m.created_at.toISOString(),
    payment_request: m.type === 'payment_request' && m.content ? paymentRequestsMap[m.content] : null,
  }))
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: SendMessageInput
): Promise<MessageOutput> {
  const { content, type, image_url, payment_request_id } = input

  // Verify conversation exists and user is participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      vendor: {
        select: { user_id: true }
      }
    }
  })

  if (!conv) {
    throw { statusCode: 404, message: 'Conversation not found' }
  }

  const isBuyer = conv.buyer_id === senderId
  const isVendor = conv.vendor.user_id === senderId

  if (!isBuyer && !isVendor) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // CRITICAL: Additional check - cannot send message if trying to self-chat
  if (isVendor && conv.vendor.user_id === conv.buyer_id) {
    throw { statusCode: 403, message: 'Cannot message in your own store' }
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversation_id: conversationId,
      sender_id: senderId,
      content: type === 'image' ? null : content,
      image_url: type === 'image' ? image_url : null,
      type,
      is_read: false,
      delivered: false,
      edited: false,
    }
  })

  // Update conversation last message
  const lastMessage = type === 'payment_request' && payment_request_id
    ? `Payment request`
    : (type === 'image' ? 'Image' : content)

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      last_message: lastMessage,
      last_message_at: new Date(),
    }
  })

  // Increment unread count for the other party
  const unreadField = isVendor ? 'buyer_unread' : 'vendor_unread'
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      [unreadField]: { increment: 1 }
    }
  })

  const messageOutput = {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: message.content,
    image_url: message.image_url,
    type: message.type as 'text' | 'image' | 'payment_request',
    is_read: message.is_read,
    delivered: message.delivered,
    edited: message.edited,
    created_at: message.created_at.toISOString(),
  }

  // Emit Socket.io event for new message (non-blocking)
  try {
    const io = getSocketIO()

    if (io) {
      // Emit to the conversation room
      io.to(`conversation:${conversationId}`).emit('new_message', messageOutput)

      // Also emit to the other party's personal room
      const otherUserId = isVendor ? conv.buyer_id : conv.vendor.user_id
      io.to(`user:${otherUserId}`).emit('new_message', messageOutput)
    }
  } catch (socketError) {
    console.error('[Chat] Socket.io emit error:', socketError)
    // Don't throw - message was successfully saved to DB
  }

  // Create notification for the recipient (non-blocking)
  const otherUserId = isVendor ? conv.buyer_id : conv.vendor.user_id
  try {
    await createNotification({
      userId: otherUserId,
      type: 'new_message',
      title: 'New message',
      body: content || 'Sent you a message',
      data: { conversation_id: conversationId, message_id: messageOutput.id },
    })
  } catch (notifError) {
    console.error('[Chat] Notification error:', notifError)
    // Don't throw - message was successfully sent
  }

  return messageOutput
}

/**
 * Mark messages as delivered
 * When a user opens a conversation, mark messages from the other party as delivered
 */
export async function markMessagesDelivered(
  conversationId: string,
  userId: string
): Promise<void> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { vendor: { select: { user_id: true } } }
  })

  if (!conv) throw { statusCode: 404, message: 'Conversation not found' }

  const isVendor = conv.vendor.user_id === userId
  if (!isVendor && conv.buyer_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // Mark all messages from other party as delivered (not read yet)
  await prisma.message.updateMany({
    where: {
      conversation_id: conversationId,
      sender_id: { not: userId },
      delivered: false,
    },
    data: { delivered: true }
  })

  // Emit Socket.io event for messages delivered (non-blocking)
  try {
    const io = getSocketIO()

    if (io) {
      // Emit to the conversation room
      io.to(`conversation:${conversationId}`).emit('message_delivered', {
        conversationId,
        userId
      })

      // Also emit to the other party's personal room (the sender of the messages)
      const otherUserId = isVendor ? conv.buyer_id : conv.vendor.user_id
      io.to(`user:${otherUserId}`).emit('message_delivered', {
        conversationId,
        userId
      })
    }
  } catch (socketError) {
    console.error('[Chat] Socket.io emit error for message_delivered:', socketError)
    // Don't throw - messages were successfully marked as delivered in DB
  }
}

/**
 * Mark messages as read
 * When a user reads messages, mark them as read and emit Socket.io event to sender
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<{ messageIds: string[]; senderId: string }> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { vendor: { select: { user_id: true } } }
  })

  if (!conv) throw { statusCode: 404, message: 'Conversation not found' }

  const isVendor = conv.vendor.user_id === userId
  if (!isVendor && conv.buyer_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  // Get the other party's user ID
  const otherUserId = isVendor ? conv.buyer_id : conv.vendor.user_id

  // Mark all unread messages from other party as read
  const updatedMessages = await prisma.message.updateMany({
    where: {
      conversation_id: conversationId,
      sender_id: otherUserId,
      is_read: false,
    },
    data: { is_read: true }
  })

  // Get the IDs of messages that were marked as read
  const messages = await prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      sender_id: otherUserId,
      is_read: true,
    },
    select: { id: true },
  })

  // Emit Socket.io event for messages read (non-blocking)
  try {
    const io = getSocketIO()

    if (io) {
      // Emit to the conversation room
      io.to(`conversation:${conversationId}`).emit('messages_read', {
        conversationId,
        messageIds: messages.map(m => m.id),
        readBy: userId
      })

      // Also emit to the other party's personal room
      io.to(`user:${otherUserId}`).emit('messages_read', {
        conversationId,
        messageIds: messages.map(m => m.id),
        readBy: userId
      })
    }
  } catch (socketError) {
    console.error('[Chat] Socket.io emit error for messages_read:', socketError)
    // Don't throw - messages were successfully marked as read in DB
  }

  return {
    messageIds: messages.map(m => m.id),
    senderId: otherUserId,
  }
}

/**
 * Reset unread count for current user
 */
export async function resetUnreadCount(
  conversationId: string,
  userId: string
): Promise<void> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { vendor: { select: { user_id: true } } }
  })

  if (!conv) throw { statusCode: 404, message: 'Conversation not found' }

  const isVendor = conv.vendor.user_id === userId
  if (!isVendor && conv.buyer_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const field = isVendor ? 'vendor_unread' : 'buyer_unread'

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { [field]: 0 }
  })
}

/**
 * Update user presence
 */
export async function updateUserPresence(
  userId: string,
  isOnline: boolean
): Promise<void> {
  await prisma.userPresence.upsert({
    where: { user_id: userId },
    update: {
      is_online: isOnline,
      last_seen: new Date(),
    },
    create: {
      user_id: userId,
      is_online: isOnline,
      last_seen: new Date(),
    },
  })

  // Emit Socket.io event for user presence update (non-blocking)
  try {
    const io = getSocketIO()

    if (io) {
      // Emit to all connected clients (they will filter for relevant user IDs)
      io.emit('user_presence', {
        userId,
        isOnline
      })
    }
  } catch (socketError) {
    console.error('[Chat] Socket.io emit error for user_presence:', socketError)
    // Don't throw - presence was successfully updated in DB
  }
}

/**
 * Get user online status
 */
export async function getUserPresence(userIds: string[]): Promise<Record<string, boolean>> {
  if (userIds.length === 0) return {}

  const presenceRecords = await prisma.userPresence.findMany({
    where: { user_id: { in: userIds } },
    select: { user_id: true, is_online: true }
  })

  return Object.fromEntries(
    presenceRecords.map(p => [p.user_id, p.is_online])
  )
}

/**
 * Create a payment request (vendor only)
 */
export async function createPaymentRequest(
  conversationId: string,
  senderId: string,
  amount: number,
  description?: string
): Promise<{
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  type: 'text' | 'image' | 'payment_request';
  is_read: boolean;
  delivered: boolean;
  created_at: string;
  // payment request data
  payment_request?: {
    id: string;
    vendor_id: string;
    buyer_id: string;
    conversation_id: string | null;
    amount: number;
    description: string | null;
    status: string;
    paid_at: string | null;
    created_at: string;
  };
}> {
  // Validate amount
  if (amount <= 0) {
    throw { statusCode: 400, message: 'Invalid amount' }
  }

  // Get conversation with vendor
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      vendor: {
        select: { id: true, user_id: true, is_active: true }
      }
    }
  })

  if (!conv) {
    throw { statusCode: 404, message: 'Conversation not found' }
  }

  // Ensure sender is the vendor of this conversation
  if (conv.vendor.user_id !== senderId) {
    throw { statusCode: 403, message: 'Only the vendor can create payment requests' }
  }

  if (!conv.vendor.is_active) {
    throw { statusCode: 400, message: 'Vendor is not active' }
  }

  if (!conv.buyer_id) {
    throw { statusCode: 400, message: 'Conversation has no buyer' }
  }

  // Create payment request
  const paymentRequest = await prisma.paymentRequest.create({
    data: {
      vendor_id: conv.vendor.id,
      buyer_id: conv.buyer_id,
      conversation_id: conversationId,
      amount,
      description: description || '',
      status: 'pending',
      vendor_user_id: conv.vendor.user_id,
    },
  })

  // Create a message to represent the payment request in chat
  const message = await prisma.message.create({
    data: {
      conversation_id: conversationId,
      sender_id: senderId,
      content: paymentRequest.id, // Store payment request ID as content for type payment_request
      image_url: null,
      type: 'payment_request',
      is_read: false,
      delivered: false,
      edited: false,
    }
  })

  // Update conversation last message
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      last_message: 'Payment request',
      last_message_at: new Date(),
    }
  })

  // Increment buyer's unread count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      buyer_unread: { increment: 1 }
    }
  })

  // Create notification for the buyer (non-blocking)
  try {
    await createNotification({
      userId: conv.buyer_id,
      type: 'payment_request',
      title: 'Payment request',
      body: `₦${amount.toLocaleString()} payment request received`,
      data: { conversation_id: conversationId, payment_request_id: paymentRequest.id },
    })
  } catch (notifError) {
    console.error('[Chat] Notification error for payment request:', notifError)
    // Don't throw - payment request was successfully created
  }

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: message.content,
    image_url: message.image_url,
    type: message.type as 'text' | 'image' | 'payment_request',
    is_read: message.is_read,
    delivered: message.delivered,
    created_at: message.created_at.toISOString(),
    payment_request: {
      id: paymentRequest.id,
      vendor_id: paymentRequest.vendor_id,
      buyer_id: paymentRequest.buyer_id,
      conversation_id: paymentRequest.conversation_id,
      amount: paymentRequest.amount,
      description: paymentRequest.description,
      status: paymentRequest.status,
      paid_at: paymentRequest.paid_at?.toISOString() ?? null,
      created_at: paymentRequest.created_at.toISOString(),
    }
  }
}

/**
 * Pay a payment request (buyer only)
 */
export async function payPaymentRequest(
  paymentRequestId: string,
  buyerId: string,
  options?: { order_type?: 'pickup' | 'delivery'; delivery_address?: string }
): Promise<{ success: boolean; message: string; orderId?: string | null }> {
  // Get payment request
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: {
      vendor: {
        select: { user_id: true }
      }
    }
  })

  if (!pr) {
    throw { statusCode: 404, message: 'Payment request not found' }
  }

  // Check buyer is authorized
  if (pr.buyer_id !== buyerId) {
    throw { statusCode: 403, message: 'Not authorized to pay this request' }
  }

  // Check status
  if (pr.status !== 'pending') {
    throw { statusCode: 400, message: `Payment request is already ${pr.status}` }
  }

  // Process the payment via wallet service
  const payResult = await WalletService.processPayment(
    buyerId,
    pr.vendor.user_id,
    pr.amount,
    pr.id,
    pr.description ?? undefined,
    {
      order_type: options?.order_type ?? 'pickup',
      delivery_address: options?.delivery_address,
    }
  )

  return {
    success: true,
    message: 'Payment processed successfully',
    orderId: payResult.orderId,
  }
}

/**
 * Cancel a payment request (vendor only)
 */
export async function cancelPaymentRequest(
  paymentRequestId: string,
  userId: string
): Promise<void> {
  // Get payment request with vendor check
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: {
      vendor: {
        select: { user_id: true }
      }
    }
  })

  if (!pr) {
    throw { statusCode: 404, message: 'Payment request not found' }
  }

  // Only the vendor who created it can cancel
  if (pr.vendor.user_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized to cancel this payment request' }
  }

  if (pr.status !== 'pending') {
    throw { statusCode: 400, message: `Payment request is already ${pr.status}` }
  }

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { status: 'cancelled' },
  })
}

/**
 * Update a message (only sender can edit, within some time window maybe)
 */
export async function updateMessage(
  messageId: string,
  userId: string,
  content: string
): Promise<MessageOutput> {
  // Find message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          vendor: { select: { user_id: true } }
        }
      }
    }
  })

  if (!message) {
    throw { statusCode: 404, message: 'Message not found' }
  }

  // Check ownership - only sender can edit
  if (message.sender_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized to edit this message' }
  }

  // Check if it's a text message (can't edit payment requests or images)
  if (message.type !== 'text') {
    throw { statusCode: 400, message: 'Cannot edit this type of message' }
  }

  // Update
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, edited: true },
  })

  // If this is the last message in the conversation, update conversation last_message
  const conv = await prisma.conversation.findUnique({
    where: { id: message.conversation_id },
  })
  if (conv) {
    const lastMsg = await prisma.message.findFirst({
      where: { conversation_id: message.conversation_id },
      orderBy: { created_at: 'desc' },
    })
    if (lastMsg?.id === messageId) {
      await prisma.conversation.update({
        where: { id: message.conversation_id },
        data: { last_message: content },
      })
    }
  }

  return {
    id: updated.id,
    conversation_id: updated.conversation_id,
    sender_id: updated.sender_id,
    content: updated.content,
    image_url: updated.image_url,
    type: updated.type as 'text' | 'image' | 'payment_request',
    is_read: updated.is_read,
    delivered: updated.delivered,
    edited: updated.edited,
    created_at: updated.created_at.toISOString(),
  }
}

/**
 * Delete a message (only sender can delete)
 */
export async function deleteMessage(
  messageId: string,
  userId: string
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  })

  if (!message) {
    throw { statusCode: 404, message: 'Message not found' }
  }

  if (message.sender_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized to delete this message' }
  }

  const conversationId = message.conversation_id

  await prisma.message.delete({
    where: { id: messageId },
  })

  // Update conversation last message if this was the last
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })
  if (conv) {
    const lastMsg = await prisma.message.findFirst({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
    })
    if (!lastMsg) {
      // No messages left
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          last_message: null,
          last_message_at: new Date(),
        },
      })
    } else {
      // Update to new last message
      const lastMessageText = lastMsg.type === 'image' ? 'Image' : (lastMsg.content ?? '')
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          last_message: lastMessageText,
          last_message_at: lastMsg.created_at,
        },
      })
    }
  }
}
