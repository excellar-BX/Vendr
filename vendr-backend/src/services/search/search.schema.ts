// search.schema.ts
import { z } from 'zod'

// Search input
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  category: z.string().optional(),
  verified_only: z
    .preprocess((val) => {
      if (typeof val === 'string') return val === 'true'
      return val
    }, z.boolean().optional())
    .default(false),
  min_rating: z.coerce.number().min(0).max(5).optional().default(0),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  max_distance: z.coerce.number().min(0).max(100).optional(), // max distance in km
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
  did_you_mean: z.string().optional(),
})

export type SearchInput = z.infer<typeof searchSchema>

// Suggestion search — includes optional userId for personalised history
export const suggestionSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().optional().default(8),
})

export type SuggestionInput = z.infer<typeof suggestionSchema>

// Unified search result (internal type used in service)
export const unifiedSearchResultSchema = z.object({
  id: z.string(),
  type: z.enum(['vendor', 'product', 'reel']),
  vendor_id: z.string(),
  vendor_user_id: z.string().nullable(),
  vendor_shop_name: z.string().nullable(),
  vendor_category: z.string().nullable(),
  vendor_lat: z.number().nullable(),
  vendor_lng: z.number().nullable(),
  vendor_logo_url: z.string().nullable(),
  vendor_banner_url: z.string().nullable(),
  vendor_avatar_url: z.string().nullable(),
  vendor_address: z.string().nullable(),
  vendor_phone: z.string().nullable(),
  vendor_whatsapp: z.string().nullable(),
  vendor_instagram: z.string().nullable(),
  vendor_twitter: z.string().nullable(),
  vendor_open_days: z.array(z.string()).nullable(),
  vendor_open_time: z.string().nullable(),
  vendor_close_time: z.string().nullable(),
  vendor_city: z.string().nullable(),
  vendor_is_verified: z.boolean().nullable(),
  vendor_rating: z.number().nullable(),
  vendor_review_count: z.number().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  price: z.number().nullable(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  product_id: z.string().nullable(),
  score: z.number(),
  distance: z.number().nullable().optional(),
})

export type UnifiedSearchResult = z.infer<typeof unifiedSearchResultSchema>

// Suggestion response types
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