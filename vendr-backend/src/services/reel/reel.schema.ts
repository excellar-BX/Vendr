import { z } from 'zod'

export const createReelSchema = z.object({
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional().nullable(),
  caption: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
})

export type CreateReelInput = z.infer<typeof createReelSchema>

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
