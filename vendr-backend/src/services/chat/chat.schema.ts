import { z } from 'zod'

// Conversation
export const createConversationSchema = z.object({
  vendor_id: z.string().uuid(),
})

export type CreateConversationInput = z.infer<typeof createConversationSchema>

export const conversationOutputSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  vendor_id: z.string(),
  last_message: z.string().nullable(),
  last_message_at: z.string(),
  buyer_unread: z.number(),
  vendor_unread: z.number(),
  created_at: z.string(),
})

export type ConversationOutput = z.infer<typeof conversationOutputSchema>

// Message
export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  type: z.enum(['text', 'image', 'payment_request']).optional().default('text'),
  image_url: z.string().url().optional().nullable(),
  payment_request_id: z.string().uuid().optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const messageOutputSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  content: z.string().nullable(),
  image_url: z.string().nullable(),
  type: z.string(),
  is_read: z.boolean(),
  delivered: z.boolean(),
  edited: z.boolean(),
  created_at: z.string(),
  payment_request: z.object({
    id: z.string(),
    vendor_id: z.string(),
    buyer_id: z.string(),
    conversation_id: z.string().nullable(),
    amount: z.number(),
    description: z.string().nullable(),
    status: z.string(),
    paid_at: z.string().nullable(),
    created_at: z.string(),
  }).nullable().optional(),
})

export type MessageOutput = z.infer<typeof messageOutputSchema>

// Vendor/Buyer info for conversation list
export const conversationListItemSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  vendor_id: z.string(),
  last_message: z.string().nullable(),
  last_message_at: z.string(),
  buyer_unread: z.number(),
  vendor_unread: z.number(),
  vendor: z.object({
    id: z.string(),
    business_name: z.string(),
    is_verified: z.boolean(),
    user_id: z.string(),
  }).nullable(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).nullable(),
})

export type ConversationListItem = z.infer<typeof conversationListItemSchema>

// Enriched conversation item (with role info)
export const enrichedConversationSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  vendor_id: z.string(),
  last_message: z.string().nullable(),
  last_message_at: z.string(),
  buyer_unread: z.number(),
  vendor_unread: z.number(),
  vendor: z.object({
    id: z.string(),
    business_name: z.string(),
    is_verified: z.boolean(),
    user_id: z.string(),
  }).nullable(),
  buyer: z.object({
    id: z.string(),
    name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).nullable(),
  iAmVendor: z.boolean(),
  other_online: z.boolean(),
  last_message_mine: z.boolean(),
  last_message_delivered: z.boolean(),
  last_message_read: z.boolean(),
})

export type EnrichedConversation = z.infer<typeof enrichedConversationSchema>
