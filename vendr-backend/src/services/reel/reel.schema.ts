import { z } from 'zod'

export const createReelSchema = z.object({
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional().nullable(),
  caption: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
})

export type CreateReInput = z.infer<typeof createReelSchema>

export const reelOutputSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  user_id: z.string(),
  video_url: z.string(),
  thumbnail_url: z.string().nullable(),
  caption: z.string().nullable(),
  product_id: z.string().nullable(),
  view_count: z.number(),
  like_count: z.number(),
  save_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
})

export type ReelOutput = z.infer<typeof reelOutputSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Enriched Types (with joins and user status)
// ─────────────────────────────────────────────────────────────────────────────

export const vendorInfoSchema = z.object({
  business_name: z.string().nullable(),
  logo_url: z.string().nullable(),
  is_verified: z.boolean().nullable(),
  category: z.string().nullable(),
})
export type VendorInfo = z.infer<typeof vendorInfoSchema>

export const productInfoSchema = z.object({
  name: z.string().nullable(),
  price: z.number().nullable(),
  image_url: z.string().nullable(),
})
export type ProductInfo = z.infer<typeof productInfoSchema>

export const reelEnrichedSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  user_id: z.string(),
  video_url: z.string(),
  thumbnail_url: z.string().nullable(),
  caption: z.string().nullable(),
  product_id: z.string().nullable(),
  view_count: z.number(),
  like_count: z.number(),
  save_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  vendor: vendorInfoSchema.nullable(),
  product: productInfoSchema.nullable(),
  is_liked: z.boolean(),
  is_saved: z.boolean(),
})
export type ReelEnriched = z.infer<typeof reelEnrichedSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Toggle (Like/Save) Responses
// ─────────────────────────────────────────────────────────────────────────────

export const toggleResponseSchema = z.object({
  liked: z.boolean().optional(),
  saved: z.boolean().optional(),
})
export type ToggleResponse = z.infer<typeof toggleResponseSchema>
