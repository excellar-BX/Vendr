import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  image_url: z.string().url().optional().nullable(),
  is_available: z.boolean().optional().default(true),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial()

export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const productOutputSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ProductOutput = z.infer<typeof productOutputSchema>
