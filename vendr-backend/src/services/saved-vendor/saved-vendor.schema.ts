import { z } from 'zod'

export const savedVendorSchema = z.object({
  vendor_id: z.string(),
})

export type SavedVendorInput = z.infer<typeof savedVendorSchema>

export const savedVendorOutputSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  vendor_id: z.string(),
  created_at: z.string(),
})

export type SavedVendorOutput = z.infer<typeof savedVendorOutputSchema>
