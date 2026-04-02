import { z } from 'zod'

export const createReviewSchema = z.object({
  vendor_id: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
})

export type CreateReviewInput = z.infer<typeof createReviewSchema>

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional().nullable(),
})

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>

export const reviewOutputSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  user_id: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  created_at: z.string(),
  reviewer_name: z.string().nullable(),
  reviewer_avatar: z.string().nullable().optional(),
})

export type ReviewOutput = z.infer<typeof reviewOutputSchema>
