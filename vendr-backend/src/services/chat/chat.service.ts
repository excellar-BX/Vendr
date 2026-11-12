//vendr-backend/src/services/chat/chat.service.ts
import prisma from '../../lib/prisma'
import * as WalletService from '../wallet/wallet.service'
import * as VendorAnalyticsService from '../vendor-analytics/vendor-analytics.service'
import type {
  ConversationOutput,
  SendMessageInput,
  MessageOutput,
  ReactionOutput,
} from './chat.schema'
import crypto from 'crypto'

// Socket helpers are required lazily to avoid a circular import at boot
// (lib/socket is initialised after routes are registered).
function realtime(): typeof import('../../lib/socket') {
  return require('../../lib/socket')
}

function emit(userIds: Array<string | null | undefined>, event: string, payload: unknown) {
  try {
    realtime().emitToUsers(userIds, event, payload)
  } catch (err) {
    console.error(`[Chat] Socket emit error for ${event}:`, err)
  }
}

// Notification service
const { createNotification } = require('../notification/notification.service')

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ─── Serializers ────────────────────────────────────────────────────────────

const replyToSelect = {
  select: {
    id: true,
    sender_id: true,
    sender: { select: { full_name: true } },
    content: true,
    image_url: true,
    type: true,
    deleted: true,
  },
} as const

const reactionsSelect = {
  select: {
    id: true,
    message_id: true,
    user_id: true,
    emoji: true,
    created_at: true,
  },
} as const

const messageInclude = {
  reply_to: replyToSelect,
  reactions: reactionsSelect,
} as const

function serializePaymentRequest(pr: any) {
  if (!pr) return null
  return {
    id: pr.id,
    vendor_id: pr.vendor_id,
    buyer_id: pr.buyer_id,
    conversation_id: pr.conversation_id,
    amount: pr.amount,
    delivery_fee: pr.delivery_fee ?? 0,
    is_delivery: pr.is_delivery ?? false,
    delivery_address: pr.delivery_address ?? null,
    description: pr.description,
    status: pr.status,
    paid_at: pr.paid_at?.toISOString() ?? null,
    created_at: pr.created_at.toISOString(),
  }
}

function previewText(type: string, content: string | null): string {
  if (type === 'payment_request') return 'Payment request'
  if (type === 'image') return 'Photo'
  return content ?? ''
}

function serializeMessage(m: any, paymentRequest: any = null, clientId?: string | null): MessageOutput & { client_id?: string | null } {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    content: m.deleted ? null : m.content,
    image_url: m.deleted ? null : m.image_url,
    type: m.type as 'text' | 'image' | 'payment_request',
    is_read: m.is_read,
    delivered: m.delivered,
    edited: m.edited,
    deleted: m.deleted,
    reply_to_id: m.reply_to_id ?? null,
    reply_to: m.reply_to ? {
      id: m.reply_to.id,
      sender_id: m.reply_to.sender_id,
      sender_name: m.reply_to.sender?.full_name ?? null,
      content: m.reply_to.deleted ? null : m.reply_to.content,
      image_url: m.reply_to.deleted ? null : m.reply_to.image_url,
      type: m.reply_to.type,
    } : null,
    reactions: (m.reactions ?? []).map((r: any) => ({
      id: r.id,
      message_id: r.message_id,
      user_id: r.user_id,
      emoji: r.emoji,
      created_at: r.created_at.toISOString(),
    })),
    created_at: m.created_at.toISOString(),
    payment_request: serializePaymentRequest(paymentRequest),
    ...(clientId ? { client_id: clientId } : {}),
  }
}

/**
 * Load a conversation and confirm the user is a participant.
 * Returns the ids of both sides so callers can emit to them.
 */
async function requireParticipant(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { vendor: { select: { id: true, user_id: true } } },
  })
  if (!conv) throw { statusCode: 404, message: 'Conversation not found' }

  const isVendor = conv.vendor.user_id === userId
  const isBuyer = conv.buyer_id === userId
  if (!isVendor && !isBuyer) throw { statusCode: 403, message: 'Not authorized' }

  return {
    conv,
    isVendor,
    otherUserId: isVendor ? conv.buyer_id : conv.vendor.user_id,
  }
}

/** Recompute the conversation preview after an edit/delete changes the latest message. */
async function refreshConversationPreview(conversationId: string) {
  const lastMsg = await prisma.message.findFirst({
    where: { conversation_id: conversationId, deleted: false },
    orderBy: { created_at: 'desc' },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      last_message: lastMsg ? previewText(lastMsg.type, lastMsg.content) : null,
      ...(lastMsg ? { last_message_at: lastMsg.created_at } : {}),
    },
  })
}

function conversationOutput(c: any): ConversationOutput {
  return {
    id: c.id,
    buyer_id: c.buyer_id,
    vendor_id: c.vendor_id,
    last_message: c.last_message,
    last_message_at: c.last_message_at.toISOString(),
    buyer_unread: c.buyer_unread,
    vendor_unread: c.vendor_unread,
    created_at: c.created_at.toISOString(),
  }
}

// ─── Conversations ──────────────────────────────────────────────────────────

/**
 * Get or create conversation between buyer and vendor
 * Ensures user cannot create conversation with themselves
 */
export async function getOrCreateConversation(
  buyerId: string,
  vendorId: string
): Promise<ConversationOutput> {
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

  const existing = await prisma.conversation.findUnique({
    where: { buyer_id_vendor_id: { buyer_id: buyerId, vendor_id: vendorId } }
  })
  if (existing) return conversationOutput(existing)

  try {
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

    // Record inquiry analytics (fire and forget, don't block response)
    VendorAnalyticsService.recordInquiry(vendorId).catch(err => {
      console.error('[Analytics] Failed to record inquiry:', err)
    })

    return conversationOutput(conversation)
  } catch (err: any) {
    // Two taps raced each other — the other request created it.
    if (err?.code === 'P2002') {
      const again = await prisma.conversation.findUnique({
        where: { buyer_id_vendor_id: { buyer_id: buyerId, vendor_id: vendorId } }
      })
      if (again) return conversationOutput(again)
    }
    throw err
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

  const isBuyer = conversation.buyer_id === userId
  const actingAsVendor = conversation.vendor.user_id === userId

  if (!isBuyer && !actingAsVendor) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const vendorOutput = conversation.vendor ? {
    id: conversation.vendor.id,
    business_name: conversation.vendor.shop_name, // alias
    is_verified: conversation.vendor.user?.is_vendor_verified,
    user_id: conversation.vendor.user_id,
    logo_url: conversation.vendor.logo_url ?? null,
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
    conversation: conversationOutput(conversation),
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
  const [buyerConvs, vendorConvs] = await Promise.all([
    prisma.conversation.findMany({
      where: { buyer_id: userId },
      include: {
        vendor: {
          select: {
            id: true,
            shop_name: true,
            user_id: true,
            logo_url: true,
            user: {
              select: {
                is_vendor_verified: true,
                avatar_url: true,
                full_name: true,
              },
            },
          },
        },
      },
    }),
    prisma.conversation.findMany({
      where: { vendor: { user_id: userId } },
      include: {
        buyer: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
          }
        }
      },
    }),
  ])

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
      business_name: c.vendor.shop_name,
      is_verified: c.vendor.user?.is_vendor_verified,
      user_id: c.vendor.user_id,
      logo_url: c.vendor.logo_url,
      avatar_url: c.vendor.user?.avatar_url,
    } : null,
    buyer: null,
    iAmVendor: false,
    other_user_id: c.vendor?.user_id ?? null,
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
    other_user_id: c.buyer_id,
  }))

  // Self-chat is blocked, so a conversation can't appear in both lists.
  const allConvs = [...vendorList, ...buyerList]
  allConvs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

  if (allConvs.length === 0) return allConvs

  const otherUserIds = allConvs.map(c => c.other_user_id).filter(Boolean) as string[]

  // Only the newest message per conversation (was: every message ever sent)
  const [presenceMap, lastMsgs] = await Promise.all([
    getUserPresence(otherUserIds),
    prisma.message.findMany({
      where: { conversation_id: { in: allConvs.map(c => c.id) } },
      orderBy: { created_at: 'desc' },
      distinct: ['conversation_id'],
      select: { id: true, conversation_id: true, sender_id: true, type: true, delivered: true, is_read: true, deleted: true },
    }),
  ])

  const lastMsgMap: Record<string, (typeof lastMsgs)[number]> = {}
  lastMsgs.forEach(m => { lastMsgMap[m.conversation_id] = m })

  return allConvs.map(c => {
    const lastMsg = lastMsgMap[c.id]
    const presence = presenceMap[c.other_user_id]

    return {
      ...c,
      unread: c.iAmVendor ? c.vendor_unread : c.buyer_unread,
      other_online: presence?.is_online ?? false,
      other_last_seen: presence?.last_seen ?? null,
      last_message_id: lastMsg?.id ?? null,
      last_message_type: lastMsg?.type ?? null,
      last_message_mine: lastMsg?.sender_id === userId,
      last_message_delivered: lastMsg?.delivered ?? false,
      last_message_read: lastMsg?.is_read ?? false,
      last_message_deleted: lastMsg?.deleted ?? false,
    }
  })
}

// ─── Messages ───────────────────────────────────────────────────────────────

/**
 * Get a single message by ID
 */
export async function getMessage(
  messageId: string,
  userId: string
): Promise<MessageOutput> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  })

  if (!message) {
    throw { statusCode: 404, message: 'Message not found' }
  }

  await requireParticipant(message.conversation_id, userId)

  const pr = message.type === 'payment_request' && message.content
    ? await prisma.paymentRequest.findUnique({ where: { id: message.content } })
    : null

  return serializeMessage(message, pr)
}

/**
 * Get messages for a conversation.
 * Returns the NEWEST `limit` messages (optionally older than `before`), oldest → newest.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit?: number,
  before?: string
): Promise<MessageOutput[]> {
  await requireParticipant(conversationId, userId)

  const take = Math.min(Math.max(limit ?? 50, 1), 100)
  const where: any = { conversation_id: conversationId }
  if (before) {
    const beforeDate = new Date(before)
    if (!isNaN(beforeDate.getTime())) where.created_at = { lt: beforeDate }
  }

  const newestFirst = await prisma.message.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
    include: messageInclude,
  })
  const messages = newestFirst.reverse()

  const paymentRequestIds = messages
    .filter(m => m.type === 'payment_request' && m.content)
    .map(m => m.content!)

  const paymentRequestsMap: Record<string, any> = {}
  if (paymentRequestIds.length > 0) {
    const paymentRequests = await prisma.paymentRequest.findMany({
      where: { id: { in: paymentRequestIds } },
    })
    paymentRequests.forEach(pr => { paymentRequestsMap[pr.id] = pr })
  }

  return messages.map(m => serializeMessage(
    m,
    m.type === 'payment_request' && m.content ? paymentRequestsMap[m.content] : null
  ))
}

// Offline clients retry sends. If the server stored a message but the reply was lost,
// the retry carries the same client_id — return the original instead of duplicating it.
const recentClientIds = new Map<string, { messageId: string; at: number }>()
const CLIENT_ID_TTL_MS = 30 * 60 * 1000

function rememberClientId(key: string, messageId: string) {
  const now = Date.now()
  if (recentClientIds.size > 2000) {
    for (const [k, v] of recentClientIds) if (now - v.at > CLIENT_ID_TTL_MS) recentClientIds.delete(k)
  }
  recentClientIds.set(key, { messageId, at: now })
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: SendMessageInput
): Promise<MessageOutput> {
  const { content, type, image_url, reply_to_id, client_id } = input

  if (type === 'payment_request') {
    throw { statusCode: 400, message: 'Use the payment request endpoint' }
  }
  const trimmed = content?.trim() ?? ''
  if (type === 'text' && !trimmed) {
    throw { statusCode: 400, message: 'Message cannot be empty' }
  }
  if (type === 'image' && !image_url) {
    throw { statusCode: 400, message: 'image_url is required for image messages' }
  }

  const { conv, isVendor, otherUserId } = await requireParticipant(conversationId, senderId)

  const dedupeKey = client_id ? `${senderId}:${client_id}` : null
  const seen = dedupeKey ? recentClientIds.get(dedupeKey) : undefined
  if (seen && Date.now() - seen.at < CLIENT_ID_TTL_MS) {
    const existing = await prisma.message.findUnique({ where: { id: seen.messageId }, include: messageInclude })
    if (existing) return serializeMessage(existing, null, client_id)
  }

  // CRITICAL: Additional check - cannot send message if trying to self-chat
  if (conv.vendor.user_id === conv.buyer_id) {
    throw { statusCode: 403, message: 'Cannot message in your own store' }
  }

  if (reply_to_id) {
    const replyMsg = await prisma.message.findUnique({
      where: { id: reply_to_id },
      select: { conversation_id: true }
    })
    if (!replyMsg || replyMsg.conversation_id !== conversationId) {
      throw { statusCode: 400, message: 'Invalid reply target' }
    }
  }

  // If the recipient has the app open right now, it's delivered on arrival.
  let recipientOnline = false
  try { recipientOnline = await realtime().isUserConnected(otherUserId) } catch { /* socket not ready */ }

  const unreadField = isVendor ? 'buyer_unread' : 'vendor_unread'
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        content: type === 'image' ? (trimmed || null) : trimmed,
        image_url: type === 'image' ? image_url : null,
        type,
        is_read: false,
        delivered: recipientOnline,
        edited: false,
        deleted: false,
        reply_to_id: reply_to_id ?? null,
      },
      include: messageInclude,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        last_message: previewText(type, trimmed),
        last_message_at: new Date(),
        [unreadField]: { increment: 1 },
      }
    }),
  ])

  if (dedupeKey) rememberClientId(dedupeKey, message.id)
  const messageOutput = serializeMessage(message, null, client_id)

  // Both sides: the recipient sees it, the sender's other devices stay in sync.
  emit([senderId, otherUserId], 'new_message', messageOutput)

  try {
    await createNotification({
      userId: otherUserId,
      type: 'new_message',
      title: 'New message',
      body: reply_to_id
        ? '↩️ Replied to your message'
        : (trimmed || (type === 'image' ? '📷 Sent a photo' : 'Sent you a message')),
      data: { conversation_id: conversationId, message_id: messageOutput.id },
    })
  } catch (notifError) {
    console.error('[Chat] Notification error:', notifError)
  }

  return messageOutput
}

/**
 * Mark messages from the other party as delivered
 */
export async function markMessagesDelivered(
  conversationId: string,
  userId: string
): Promise<{ messageIds: string[] }> {
  const { otherUserId } = await requireParticipant(conversationId, userId)

  const pending = await prisma.message.findMany({
    where: { conversation_id: conversationId, sender_id: otherUserId, delivered: false },
    select: { id: true },
  })
  const messageIds = pending.map(m => m.id)
  if (messageIds.length === 0) return { messageIds }

  await prisma.message.updateMany({
    where: { id: { in: messageIds } },
    data: { delivered: true },
  })

  emit([otherUserId, userId], 'message_delivered', { conversationId, messageIds, userId })
  return { messageIds }
}

/**
 * Mark messages as read (also implies delivered) and clear the reader's unread counter.
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<{ messageIds: string[]; senderId: string }> {
  const { isVendor, otherUserId } = await requireParticipant(conversationId, userId)

  const unread = await prisma.message.findMany({
    where: { conversation_id: conversationId, sender_id: otherUserId, is_read: false },
    select: { id: true },
  })
  const messageIds = unread.map(m => m.id)

  await prisma.$transaction([
    prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: { is_read: true, delivered: true },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { [isVendor ? 'vendor_unread' : 'buyer_unread']: 0 },
    }),
  ])

  // Always tell the reader's own devices (clears badges); tell the sender only if something changed.
  emit(messageIds.length > 0 ? [otherUserId, userId] : [userId], 'messages_read', {
    conversationId,
    messageIds,
    readBy: userId,
  })

  return { messageIds, senderId: otherUserId }
}

/**
 * Reset unread count for current user
 */
export async function resetUnreadCount(
  conversationId: string,
  userId: string
): Promise<void> {
  const { isVendor } = await requireParticipant(conversationId, userId)
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { [isVendor ? 'vendor_unread' : 'buyer_unread']: 0 }
  })
}

// ─── Presence ───────────────────────────────────────────────────────────────

/**
 * Update user presence. Presence is normally driven by the socket connection;
 * this exists for clients that still call POST /presence.
 */
export async function updateUserPresence(
  userId: string,
  isOnline: boolean
): Promise<void> {
  // Never let a stale "offline" call override a live socket connection.
  if (!isOnline) {
    try {
      if (await realtime().isUserConnected(userId)) return
    } catch { /* socket not ready */ }
  }
  await realtime().setPresence(userId, isOnline)
}

/**
 * Get user online status
 */
export async function getUserPresence(userIds: string[]): Promise<Record<string, { is_online: boolean; last_seen?: string }>> {
  if (userIds.length === 0) return {}

  const presenceRecords = await prisma.userPresence.findMany({
    where: { user_id: { in: userIds } },
    select: { user_id: true, is_online: true, last_seen: true }
  })

  return Object.fromEntries(
    presenceRecords.map(p => [p.user_id, { is_online: p.is_online, last_seen: p.last_seen?.toISOString() }])
  )
}

// ─── Payment requests ───────────────────────────────────────────────────────

/**
 * Create a payment request (vendor only)
 */
export async function createPaymentRequest(
  conversationId: string,
  senderId: string,
  amount: number,
  description?: string,
  isDelivery?: boolean,
  deliveryAddress?: string,
  deliveryLat?: number,
  deliveryLng?: number,
  deliveryFee?: number
): Promise<MessageOutput> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw { statusCode: 400, message: 'Invalid amount' }
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      vendor: {
        select: { id: true, user_id: true, is_active: true, lat: true, lng: true }
      }
    }
  })

  if (!conv) {
    throw { statusCode: 404, message: 'Conversation not found' }
  }

  if (conv.vendor.user_id !== senderId) {
    throw { statusCode: 403, message: 'Only the vendor can create payment requests' }
  }

  if (!conv.vendor.is_active) {
    throw { statusCode: 400, message: 'Vendor is not active' }
  }

  if (!conv.buyer_id) {
    throw { statusCode: 400, message: 'Conversation has no buyer' }
  }

  // Calculate delivery fee if delivery is requested and not provided
  let calculatedDeliveryFee = deliveryFee || 0
  if (isDelivery && !deliveryFee && deliveryLat && deliveryLng && conv.vendor.lat && conv.vendor.lng) {
    const distanceKm = calculateDistance(conv.vendor.lat, conv.vendor.lng, deliveryLat, deliveryLng)
    // Base fee ₦200 + ₦100 per km
    calculatedDeliveryFee = 200 + (distanceKm * 100)
  }

  const paymentRequest = await prisma.paymentRequest.create({
    data: {
      vendor_id: conv.vendor.id,
      buyer_id: conv.buyer_id,
      conversation_id: conversationId,
      amount,
      delivery_fee: calculatedDeliveryFee,
      is_delivery: isDelivery || false,
      delivery_address: deliveryAddress,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      description: description || '',
      status: 'pending',
      vendor_user_id: conv.vendor.user_id,
    },
  })

  let buyerOnline = false
  try { buyerOnline = await realtime().isUserConnected(conv.buyer_id) } catch { /* socket not ready */ }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        content: paymentRequest.id, // payment request ID stored as content
        image_url: null,
        type: 'payment_request',
        is_read: false,
        delivered: buyerOnline,
        edited: false,
      },
      include: messageInclude,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        last_message: 'Payment request',
        last_message_at: new Date(),
        buyer_unread: { increment: 1 },
      }
    }),
  ])

  const output = serializeMessage(message, paymentRequest)
  emit([senderId, conv.buyer_id], 'new_message', output)

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
  }

  return output
}

/** Push the latest payment-request state to both sides of its conversation. */
async function broadcastPaymentRequest(paymentRequestId: string) {
  const pr = await prisma.paymentRequest.findUnique({ where: { id: paymentRequestId } })
  if (!pr?.conversation_id) return
  emit([pr.buyer_id, pr.vendor_user_id], 'payment_request_updated', {
    conversationId: pr.conversation_id,
    paymentRequest: serializePaymentRequest(pr),
  })
}

/**
 * Pay a payment request (buyer only)
 */
export async function payPaymentRequest(
  paymentRequestId: string,
  buyerId: string,
  options?: { order_type?: 'pickup' | 'delivery'; delivery_address?: string }
): Promise<{ success: boolean; message: string; orderId?: string | null }> {
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: {
      vendor: {
        select: { user_id: true, id: true, lat: true, lng: true, address: true }
      }
    }
  })

  if (!pr) {
    throw { statusCode: 404, message: 'Payment request not found' }
  }

  if (pr.buyer_id !== buyerId) {
    throw { statusCode: 403, message: 'Not authorized to pay this request' }
  }

  if (pr.status !== 'pending') {
    throw { statusCode: 400, message: `Payment request is already ${pr.status}` }
  }

  const isDelivery = pr.is_delivery || options?.order_type === 'delivery'
  const orderType = isDelivery ? 'delivery' : 'pickup'
  const deliveryAddress = pr.delivery_address || options?.delivery_address
  const deliveryFee = pr.delivery_fee || 0

  const payResult = await WalletService.processPayment(
    buyerId,
    pr.vendor.user_id,
    pr.amount + deliveryFee, // Total includes delivery fee
    pr.id,
    pr.description ?? undefined,
    {
      order_type: orderType,
      delivery_address: deliveryAddress,
      delivery_fee: deliveryFee,
      delivery_lat: pr.delivery_lat,
      delivery_lng: pr.delivery_lng,
    }
  )

  // A runner job only makes sense with a real fee and real pickup/drop-off points.
  // (Buyer-chosen delivery without them used to post a ₦0 job dropping off at 0,0 —
  // no runner would take it.) Otherwise the vendor delivers and verifies the buyer's code.
  const runnerDelivery = isDelivery && deliveryFee > 0
    && pr.delivery_lat != null && pr.delivery_lng != null
    && pr.vendor.lat != null && pr.vendor.lng != null
  if (runnerDelivery && payResult.orderId) {
    try {
      const pickupLat = pr.vendor.lat || 0
      const pickupLng = pr.vendor.lng || 0
      const pickupAddress = pr.vendor.address || 'Vendor location'

      const distanceKm = pr.delivery_lat && pr.delivery_lng
        ? calculateDistance(pickupLat, pickupLng, pr.delivery_lat, pr.delivery_lng)
        : 0
      const estimatedTime = Math.ceil(distanceKm * 15) + ' min' // Rough estimate: 15 min per km

      const job = await prisma.deliveryJob.create({
        data: {
          order_id: payResult.orderId,
          seller_id: pr.vendor.user_id,
          pickup_address: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_address: deliveryAddress || '',
          dropoff_lat: pr.delivery_lat || 0,
          dropoff_lng: pr.delivery_lng || 0,
          distance_km: distanceKm,
          estimated_time: estimatedTime,
          delivery_fee: deliveryFee,
          items: [{ name: pr.description || 'Items', quantity: 1 }],
          status: 'pending',
          // Paid orders don't expire from the runner board; this is informational only
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      // Seller reads this 6-digit code to the runner at pickup; the buyer's delivery
      // code (otp_code) confirms drop-off. delivery_qr stays for future QR scanning.
      const pickupToken = String(crypto.randomInt(100000, 1000000))
      const deliveryToken = crypto.randomBytes(16).toString('hex')
      const qrExpiresAt = new Date()
      qrExpiresAt.setHours(qrExpiresAt.getHours() + 24)

      await prisma.order.update({
        where: { id: payResult.orderId },
        data: {
          pickup_qr: pickupToken,
          delivery_qr: deliveryToken,
          qr_expires_at: qrExpiresAt,
          delivery_lat: pr.delivery_lat,
          delivery_lng: pr.delivery_lng,
        },
      })

      const { notifyRunnersOfJob } = require('../runner/runner.service')
      notifyRunnersOfJob(job.id).catch((err: any) => console.error('[Chat] runner alert failed:', err?.message))
    } catch (error) {
      console.error('Failed to create delivery job:', error)
      // Don't fail the payment if delivery job creation fails
    }
  }

  broadcastPaymentRequest(pr.id).catch(err =>
    console.error('[Chat] payment_request_updated emit failed:', err)
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
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { vendor: { select: { user_id: true } } }
  })

  if (!pr) {
    throw { statusCode: 404, message: 'Payment request not found' }
  }

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

  broadcastPaymentRequest(paymentRequestId).catch(err =>
    console.error('[Chat] payment_request_updated emit failed:', err)
  )
}

// ─── Edit / delete ──────────────────────────────────────────────────────────

/**
 * Edit a text message (sender only)
 */
export async function updateMessage(
  messageId: string,
  userId: string,
  content: string
): Promise<MessageOutput> {
  const trimmed = content.trim()
  if (!trimmed) throw { statusCode: 400, message: 'Message cannot be empty' }
  if (trimmed.length > 2000) throw { statusCode: 400, message: 'Message is too long' }

  const message = await prisma.message.findUnique({ where: { id: messageId } })

  if (!message) {
    throw { statusCode: 404, message: 'Message not found' }
  }

  if (message.sender_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized to edit this message' }
  }

  if (message.deleted) {
    throw { statusCode: 400, message: 'Cannot edit a deleted message' }
  }

  if (message.type !== 'text') {
    throw { statusCode: 400, message: 'Cannot edit this type of message' }
  }

  const { otherUserId } = await requireParticipant(message.conversation_id, userId)

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: trimmed, edited: true },
    include: messageInclude,
  })

  // Keep the chat-list preview in sync if this is the latest message
  const lastMsg = await prisma.message.findFirst({
    where: { conversation_id: message.conversation_id, deleted: false },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  })
  if (lastMsg?.id === messageId) {
    await prisma.conversation.update({
      where: { id: message.conversation_id },
      data: { last_message: trimmed },
    })
  }

  const output = serializeMessage(updated)
  emit([userId, otherUserId], 'message_updated', output)
  return output
}

/**
 * Delete a message (only sender can delete) — soft delete
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

  if (message.type === 'payment_request') {
    throw { statusCode: 400, message: 'Cancel the payment request instead' }
  }

  if (message.deleted) return

  const conversationId = message.conversation_id
  const { otherUserId } = await requireParticipant(conversationId, userId)

  await prisma.message.update({
    where: { id: messageId },
    data: {
      deleted: true,
      deleted_at: new Date(),
      content: null,
      image_url: null,
    }
  })

  await refreshConversationPreview(conversationId)

  emit([userId, otherUserId], 'message_deleted', { conversationId, messageId })
}

// ─── Reactions ──────────────────────────────────────────────────────────────

export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<ReactionOutput> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversation_id: true, deleted: true }
  })

  if (!message) throw { statusCode: 404, message: 'Message not found' }
  if (message.deleted) throw { statusCode: 400, message: 'Cannot react to a deleted message' }

  const { otherUserId } = await requireParticipant(message.conversation_id, userId)

  const reaction = await prisma.messageReaction.upsert({
    where: { message_id_user_id: { message_id: messageId, user_id: userId } },
    update: { emoji },
    create: { message_id: messageId, user_id: userId, emoji }
  })

  const output: ReactionOutput = {
    id: reaction.id,
    message_id: reaction.message_id,
    user_id: reaction.user_id,
    emoji: reaction.emoji,
    created_at: reaction.created_at.toISOString(),
  }

  emit([userId, otherUserId], 'reaction_added', {
    conversationId: message.conversation_id,
    messageId,
    reaction: output,
  })

  return output
}

export async function removeReaction(
  messageId: string,
  userId: string
): Promise<void> {
  const existing = await prisma.messageReaction.findUnique({
    where: { message_id_user_id: { message_id: messageId, user_id: userId } },
    select: { id: true, message: { select: { conversation_id: true } } }
  })

  if (!existing) return // already gone — idempotent

  await prisma.messageReaction.delete({
    where: { message_id_user_id: { message_id: messageId, user_id: userId } }
  })

  const conversationId = existing.message.conversation_id
  const { otherUserId } = await requireParticipant(conversationId, userId)

  emit([userId, otherUserId], 'reaction_removed', { conversationId, messageId, userId })
}
