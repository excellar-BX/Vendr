
import { z } from 'zod'

export const getAnalyticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all']).default('all'),
})

export type GetAnalyticsInput = z.infer<typeof getAnalyticsSchema>

export const recordProfileViewSchema = z.object({
  vendor_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
})

export type RecordProfileViewInput = z.infer<typeof recordProfileViewSchema>

export const recordProductViewSchema = z.object({
  product_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
})

export type RecordProductViewInput = z.infer<typeof recordProductViewSchema>

export const recordInquirySchema = z.object({
  vendor_id: z.string().uuid(),
})

export type RecordInquiryInput = z.infer<typeof recordInquirySchema>

export const recordOrderSchema = z.object({
  vendor_id: z.string().uuid(),
  product_id: z.string().uuid(),
  amount: z.number().positive(),
})

export type RecordOrderInput = z.infer<typeof recordOrderSchema>

export const getProductAnalyticsSchema = z.object({
  product_id: z.string().uuid(),
  period: z.enum(['day', 'week', 'month', 'all']).default('all'),
})

export type GetProductAnalyticsInput = z.infer<typeof getProductAnalyticsSchema>
