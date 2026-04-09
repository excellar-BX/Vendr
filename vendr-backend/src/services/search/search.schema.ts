//search.schema.ts
import { z } from 'zod'

// Search input
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  category: z.string().optional(),
  verified_only: z
    .preprocess((val) => {
      // Convert query string "true"/"false" to boolean correctly
      if (typeof val === 'string') return val === 'true';
      return val;
    }, z.boolean().optional())
    .default(false),
  min_rating: z.coerce.number().min(0).max(5).optional().default(0),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
})

export type SearchInput = z.infer<typeof searchSchema>

// Suggestion search (lighter weight)
export const suggestionSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().optional().default(5),
})

export type SuggestionInput = z.infer<typeof suggestionSchema>

// Search result types - unified feed
export const unifiedSearchResultSchema = z.object({
  id: z.string(),
  type: z.enum(['vendor', 'product']),
  // Vendor fields (present for both, with product's vendor_name for products)
  vendor_id: z.string(),
  vendor_user_id: z.string().nullable(),
  vendor_shop_name: z.string().nullable(),
  vendor_category: z.string().nullable(),
  vendor_lat: z.number().nullable(),
  vendor_lng: z.number().nullable(),
  vendor_logo_url: z.string().nullable(),
  vendor_is_verified: z.boolean().nullable(),
  vendor_rating: z.number().nullable(),
  vendor_review_count: z.number().nullable(),
  // Entity-specific fields
  name: z.string().nullable(), // vendor shop_name or product name
  description: z.string().nullable(),
  price: z.number().nullable(),
  image_url: z.string().nullable(),
  // Metadata
  score: z.number(),
  distance: z.number().nullable().optional(),
})

export type UnifiedSearchResult = z.infer<typeof unifiedSearchResultSchema>

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
