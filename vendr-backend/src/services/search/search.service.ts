import prisma from '../../lib/prisma'
import type {
  SearchInput,
  SuggestionInput,
  VendorSearchResult,
  ProductSearchResult,
  ProductSuggestion,
  VendorSuggestion,
} from './search.schema'

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Extract search term by removing filler words
 */
export function extractSearchTerm(raw: string): string {
  let q = raw.toLowerCase()
  const fillers = [
    'near me', 'around me', 'close to me', 'nearby', 'in lagos', 'in abuja',
    'in nigeria', 'around here', 'close by', 'around', 'near',
    'vendor', 'vendors', 'seller', 'sellers', 'shop', 'store', 'stores',
    'cheap', 'cheapest', 'affordable', 'best', 'good', 'top', 'quality',
    'where can i buy', 'where to buy', 'i need', 'i want', 'looking for',
    'find me', 'get me', 'show me',
  ]
  fillers.forEach(f => { q = q.replace(new RegExp(`\\b${f}\\b`, 'gi'), '') })
  return q.replace(/\s+/g, ' ').trim() || raw.trim()
}

/**
 * Search vendors and products with filters
 */
export async function searchVendorsAndProducts(input: SearchInput): Promise<{
  vendors: VendorSearchResult[]
  products: ProductSearchResult[]
  totalVendors: number
  totalProducts: number
}> {
  const { q, category, verified_only, min_rating, lat, lng, limit, offset } = input

  // Extract real search term by stripping filler words
  const term = extractSearchTerm(q)
  const searchTerm = `%${term}%`

  // Build vendor query
  const vendorWhere: any = {
    is_active: true,
    AND: [
      {
        OR: [
          { shop_name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ]
      }
    ]
  }

  if (category && category !== 'All') {
    vendorWhere.category = category
  }
  if (verified_only) {
    vendorWhere.is_verified = true
  }
  if (min_rating > 0) {
    vendorWhere.rating = { gte: min_rating }
  }

  // Get total count
  const totalVendors = await prisma.vendor.count({ where: vendorWhere })

  // Get vendors with pagination
  const vendors = await prisma.vendor.findMany({
    where: vendorWhere,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          avatar_url: true,
          created_at: true,
        }
      }
    },
    orderBy: lat && lng ? { rating: 'desc' } : { rating: 'desc' },
    take: limit,
    skip: offset,
  })

  // Calculate distances if lat/lng provided
  let vendorsWithDistance: VendorSearchResult[] = vendors.map(v => ({
    id: v.id,
    user_id: v.user_id,
    shop_name: v.shop_name,
    description: v.description,
    category: v.category ?? 'Other',
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    phone: v.phone,
    whatsapp: v.whatsapp,
    instagram: v.instagram,
    twitter: v.twitter,
    open_days: v.open_days,
    open_time: v.open_time,
    close_time: v.close_time,
    logo_url: v.logo_url,
    banner_url: v.banner_url,
    is_verified: v.is_verified,
    is_active: v.is_active,
    rating: v.rating,
    review_count: v.review_count,
    created_at: v.created_at.toISOString(),
    updated_at: v.updated_at.toISOString(),
    user: {
      id: v.user.id,
      full_name: v.user.full_name,
      avatar_url: v.user.avatar_url,
      created_at: v.user.created_at.toISOString(),
    },
    distance: null,
  }))

  if (lat && lng) {
    vendorsWithDistance = vendorsWithDistance.map(v => ({
      ...v,
      distance: v.lat && v.lng ? calcDistance(lat, lng, v.lat, v.lng) : null,
    })).sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
  }

  // Build product query
  const productWhere: any = {
    is_available: true,
    OR: [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ]
  }

  const totalProducts = await prisma.product.count({ where: productWhere })

  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      vendor: {
        select: {
          shop_name: true,
        }
      }
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  })

  const productResults: ProductSearchResult[] = products.map(p => ({
    id: p.id,
    vendor_id: p.vendor_id,
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.image_url,
    is_available: p.is_available,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
    vendor_name: p.vendor.shop_name,
  }))

  return {
    vendors: vendorsWithDistance,
    products: productResults,
    totalVendors,
    totalProducts,
  }
}

/**
 * Get search suggestions (lightweight)
 */
export async function getSearchSuggestions(input: SuggestionInput): Promise<{
  products: ProductSuggestion[]
  vendors: VendorSuggestion[]
}> {
  const { q, limit } = input
  const term = extractSearchTerm(q)
  const searchTerm = `%${term}%`

  // Get product suggestions (limited)
  const products = await prisma.product.findMany({
    where: {
      is_available: true,
      name: { contains: term, mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      price: true,
      image_url: true,
      vendor_id: true,
    },
    orderBy: { name: 'asc' },
    take: Math.min(limit, 2),
  })

  // Get vendor suggestions (limited)
  const vendors = await prisma.vendor.findMany({
    where: {
      is_active: true,
      shop_name: { contains: term, mode: 'insensitive' }
    },
    select: {
      id: true,
      shop_name: true,
      category: true,
      logo_url: true,
      rating: true,
    },
    orderBy: { rating: 'desc' },
    take: Math.min(limit, 1),
  })

  return {
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      vendor_id: p.vendor_id,
    })),
    vendors: vendors.map(v => ({
      id: v.id,
      business_name: v.shop_name,  // Return as business_name for frontend compatibility
      category: v.category,
      logo_url: v.logo_url,
      rating: v.rating,
    })),
  }
}

/**
 * Get user's search history
 */
export async function getUserSearchHistory(userId: string, limit: number = 10): Promise<string[]> {
  const history = await prisma.searchHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      query: true,
    }
  })

  return [...new Set(history.map(h => h.query))]
}

/**
 * Save search query to history
 */
export async function saveSearchQuery(userId: string, query: string): Promise<void> {
  // Trim and validate
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return

  // Save (allow duplicates, dedupe on read)
  await prisma.searchHistory.create({
    data: {
      user_id: userId,
      query: trimmedQuery,
    }
  })

  // Keep only latest 50 per user (cleanup old ones)
  const allHistory = await prisma.searchHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  })

  if (allHistory.length > 50) {
    const toDelete = allHistory.slice(50).map(h => h.id)
    await prisma.searchHistory.deleteMany({
      where: { id: { in: toDelete } }
    })
  }
}

/**
 * Clear user search history
 */
export async function clearSearchHistory(userId: string): Promise<void> {
  await prisma.searchHistory.deleteMany({
    where: { user_id: userId }
  })
}
