import { z } from 'zod'

// Search input
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  category: z.string().optional(),
  verified_only: z.boolean().optional().default(false),
  min_rating: z.number().min(0).max(5).optional().default(0),
  lat: z.number().optional(),
  lng: z.number().optional(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
})

export type SearchInput = z.infer<typeof searchSchema>

// Suggestion search (lighter weight)
export const suggestionSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().optional().default(5),
})

export type SuggestionInput = z.infer<typeof suggestionSchema>

// Search result types
export const vendorSearchResultSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  shop_name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  twitter: z.string().nullable(),
  open_days: z.array(z.string()),
  open_time: z.string(),
  close_time: z.string(),
  logo_url: z.string().nullable(),
  banner_url: z.string().nullable(),
  is_verified: z.boolean(),
  is_active: z.boolean(),
  rating: z.number(),
  review_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  user: z.object({
    id: z.string(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    created_at: z.string(),
  }),
  distance: z.number().nullable().optional(),
})

export type VendorSearchResult = z.infer<typeof vendorSearchResultSchema>

export const productSearchResultSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  vendor_name: z.string().nullable(),
})

export type ProductSearchResult = z.infer<typeof productSearchResultSchema>

// Suggestion types
export const productSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  image_url: z.string().nullable(),
  vendor_id: z.string(),
})

export type ProductSuggestion = z.infer<typeof productSuggestionSchema>

export const vendorSuggestionSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  category: z.string().nullable(),
  logo_url: z.string().nullable(),
  rating: z.number(),
})

export type VendorSuggestion = z.infer<typeof vendorSuggestionSchema>

// Search history
export const searchHistorySchema = z.object({
  query: z.string().min(1).max(100),
})

export type SearchHistoryInput = z.infer<typeof searchHistorySchema>
