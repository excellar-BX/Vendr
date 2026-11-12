import { z } from 'zod'

export const MAX_REEL_PHOTOS = 10

export const createReelSchema = z
  .object({
    media_type: z.enum(['video', 'photo']).optional().default('video'),
    video_url: z.string().url().optional().nullable(),
    image_urls: z.array(z.string().url()).max(MAX_REEL_PHOTOS).optional().default([]),
    thumbnail_url: z.string().url().optional().nullable(),
    caption: z.string().max(500).optional().nullable(),
    product_id: z.string().optional().nullable(),
    /** Which of the user's stores to post as (defaults to the tagged product's store) */
    vendor_id: z.string().optional().nullable(),
  })
  .refine((d) => (d.media_type === 'video' ? !!d.video_url : d.image_urls.length > 0), {
    message: 'A video post needs video_url; a photo post needs at least one image',
    path: ['media_type'],
  })

export type CreateReInput = z.infer<typeof createReelSchema>

/** Edits allowed within this window after posting */
export const REEL_EDIT_WINDOW_MS = 15 * 60 * 1000

export const updateReelSchema = z
  .object({
    caption: z.string().max(500).optional().nullable(),
    product_id: z.string().optional().nullable(),
  })
  .refine((d) => d.caption !== undefined || d.product_id !== undefined, { message: 'Nothing to update' })

export type UpdateReelInput = z.infer<typeof updateReelSchema>

export const reelOutputSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  user_id: z.string(),
  media_type: z.enum(['video', 'photo']),
  video_url: z.string().nullable(),
  image_urls: z.array(z.string()),
  thumbnail_url: z.string().nullable(),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  product_id: z.string().nullable(),
  view_count: z.number(),
  like_count: z.number(),
  save_count: z.number(),
  comment_count: z.number(),
  share_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  /** Owner may edit until this time (ISO) */
  editable_until: z.string(),
})

export type ReelOutput = z.infer<typeof reelOutputSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Enriched Types (with joins and user status)
// ─────────────────────────────────────────────────────────────────────────────

export const vendorInfoSchema = z.object({
  user_id: z.string().nullable().optional(),
  business_name: z.string().nullable(),
  logo_url: z.string().nullable(),
  is_verified: z.boolean().nullable(),
  category: z.string().nullable(),
  follower_count: z.number().optional(),
  city: z.string().nullable().optional(),
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
  media_type: z.enum(['video', 'photo']),
  video_url: z.string().nullable(),
  image_urls: z.array(z.string()),
  thumbnail_url: z.string().nullable(),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  product_id: z.string().nullable(),
  view_count: z.number(),
  like_count: z.number(),
  save_count: z.number(),
  comment_count: z.number(),
  share_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  /** Owner may edit until this time (ISO) */
  editable_until: z.string(),
  vendor: vendorInfoSchema.nullable(),
  product: productInfoSchema.nullable(),
  is_liked: z.boolean(),
  is_saved: z.boolean(),
  is_following: z.boolean(),
  /** km from the viewer, when they shared a location */
  distance_km: z.number().nullable().optional(),
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
