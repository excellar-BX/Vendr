import { z } from 'zod'

export const updatePreferencesSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  language: z.string().optional(),
  font_size: z.string().optional()
})

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>

export const updateMyProfileSchema = z.object({
  full_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
})

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>

export const getMyProfileOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  phone: z.string().nullable(),
  is_verified: z.boolean(),
  notifications_enabled: z.boolean(),
  language: z.string(),
  font_size: z.string(),
  created_at: z.string(),
  vendor: z.object({
    id: z.string(),
    shop_name: z.string(),
    is_active: z.boolean()
  }).nullable(),
  stats: z.object({
    orders: z.number(),
    reviews: z.number(),
    saved: z.number()
  }),
  unread_notifications_count: z.number()
})

export type GetMyProfileOutput = z.infer<typeof getMyProfileOutputSchema>
