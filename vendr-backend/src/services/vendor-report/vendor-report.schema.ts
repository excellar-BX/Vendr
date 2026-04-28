import { z } from 'zod'

export const vendorReportSchema = z.object({
  vendor_id: z.string().uuid(),
  reason: z.enum(['fraud', 'fake_products', 'inappropriate_content', 'harassment', 'other']),
  description: z.string().optional(),
})

export type VendorReportInput = z.infer<typeof vendorReportSchema>

export const updateVendorReportSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']),
  admin_notes: z.string().optional(),
})

export type UpdateVendorReportInput = z.infer<typeof updateVendorReportSchema>
