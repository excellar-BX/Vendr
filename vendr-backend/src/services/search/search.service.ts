import { normalizeTag } from '../reel/hashtag.service'
// search.service.ts
import prisma from '../../lib/prisma'
import type {
  SearchInput,
  SuggestionInput,
  UnifiedSearchResult,
  ProductSuggestion,
  VendorSuggestion,
} from './search.schema'

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in km
 */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for spell correction / "did you mean" suggestions
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find similar terms for spell correction
 * Returns the best matching term if within acceptable edit distance
 */
async function findSimilarTerm(searchTerm: string): Promise<string | null> {
  const MAX_DISTANCE = 2 // Maximum edit distance for a suggestion
  const MIN_LENGTH = 3    // Minimum term length to consider

  if (searchTerm.length < MIN_LENGTH) return null

  // Sample product names, vendor names, and categories
  const [products, vendors] = await Promise.all([
    prisma.product.findMany({
      where: { is_available: true, vendor: { is_active: true } },
      select: { name: true },
      take: 100,
    }),
    prisma.vendor.findMany({
      where: { is_active: true, is_suspended: false },
      select: { shop_name: true, category: true },
      take: 100,
    }),
  ])

  const allTerms = new Set<string>()
  products.forEach(p => {
    p.name.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length >= MIN_LENGTH) allTerms.add(w)
    })
  })
  vendors.forEach(v => {
    v.shop_name.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length >= MIN_LENGTH) allTerms.add(w)
    })
    if (v.category) {
      v.category.toLowerCase().split(/\s+/).forEach(w => {
        if (w.length >= MIN_LENGTH) allTerms.add(w)
      })
    }
  })

  const searchLower = searchTerm.toLowerCase()
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const term of allTerms) {
    const distance = levenshteinDistance(searchLower, term)
    if (distance < bestDistance && distance <= MAX_DISTANCE) {
      bestDistance = distance
      bestMatch = term
    }
  }

  return bestMatch
}

/**
 * Calculate text relevance score for a vendor result
 */
function scoreVendor(
  shopName: string,
  description: string | null,
  category: string | null,
  searchTerm: string,
  words: string[]
): number {
  const nameLower = shopName.toLowerCase()
  const descLower = (description || '').toLowerCase()
  const catLower = (category || '').toLowerCase()
  const termLower = searchTerm.toLowerCase()

  let score = 0

  if (nameLower === termLower) score += 100
  else if (nameLower.startsWith(termLower)) score += 80
  else if (nameLower.includes(' ' + termLower + ' ') || nameLower.startsWith(termLower + ' '))
    score += 60
  else if (nameLower.includes(termLower)) score += 40

  if (catLower.includes(termLower) || termLower.includes(catLower)) score += 20
  if (descLower.includes(termLower)) score += 15

  const wordsInName = words.filter((w) => nameLower.includes(w)).length
  const wordsInDesc = words.filter((w) => descLower.includes(w)).length
  const wordsInCat = words.filter((w) => catLower.includes(w)).length
  score += wordsInName * 12 + wordsInDesc * 6 + wordsInCat * 8

  return score
}

/**
 * Calculate text relevance score for a product result
 */
function scoreProduct(
  productName: string,
  description: string | null,
  vendorShopName: string | null,
  searchTerm: string,
  words: string[]
): number {
  const nameLower = productName.toLowerCase()
  const descLower = (description || '').toLowerCase()
  const vendorLower = (vendorShopName || '').toLowerCase()
  const termLower = searchTerm.toLowerCase()

  let score = 0

  if (nameLower === termLower) score += 100
  else if (nameLower.startsWith(termLower)) score += 75
  else if (nameLower.includes(' ' + termLower + ' ') || nameLower.startsWith(termLower + ' '))
    score += 55
  else if (nameLower.includes(termLower)) score += 35

  if (vendorLower.includes(termLower)) score += 15
  if (descLower.includes(termLower)) score += 10

  const wordsInName = words.filter((w) => nameLower.includes(w)).length
  const wordsInDesc = words.filter((w) => descLower.includes(w)).length
  score += wordsInName * 10 + wordsInDesc * 6

  return score
}

/**
 * Calculate text relevance score for a reel result
 */
function scoreReel(
  caption: string | null,
  vendorShopName: string | null,
  productName: string | null,
  searchTerm: string,
  words: string[]
): number {
  const captionLower = (caption || '').toLowerCase()
  const vendorLower = (vendorShopName || '').toLowerCase()
  const productLower = (productName || '').toLowerCase()
  const termLower = searchTerm.toLowerCase()

  let score = 0

  if (captionLower === termLower) score += 100
  else if (captionLower.startsWith(termLower)) score += 75
  else if (
    captionLower.includes(' ' + termLower + ' ') ||
    captionLower.startsWith(termLower + ' ')
  )
    score += 55
  else if (captionLower.includes(termLower)) score += 35

  if (productLower.includes(termLower)) score += 25
  if (vendorLower.includes(termLower)) score += 15

  const wordsInCaption = words.filter((w) => captionLower.includes(w)).length
  const wordsInProduct = words.filter((w) => productLower.includes(w)).length
  score += wordsInCaption * 8 + wordsInProduct * 10

  return score
}

/**
 * Boost score based on vendor's rating and verification status
 */
function vendorBoost(vendor: any): number {
  let boost = 0
  if (vendor.user?.is_vendor_verified) boost += 8
  if (vendor.rating >= 4.5) boost += 12
  else if (vendor.rating >= 4.0) boost += 8
  else if (vendor.rating >= 3.0) boost += 4
  return boost
}

/**
 * Apply distance score bonus with stronger nearby priority for GPS-based search.
 * Nearby results get significant bonus to ensure they appear prominently.
 * Far results are heavily penalized to prioritize local discovery.
 *
 * Returns a bonus to ADD to the base score (not a multiplier).
 */
function distanceBonus(distanceKm: number | null): number {
  if (distanceKm === null) return -20      // unknown location — penalize heavily
  
  // Strong nearby priority for hyperlocal search
  if (distanceKm <= 0.5) return 50         // very close - same building/compound
  if (distanceKm <= 1) return 40           // walking distance
  if (distanceKm <= 2) return 30           // short drive/walk
  if (distanceKm <= 3) return 20           // nearby neighborhood
  if (distanceKm <= 5) return 10           // same area
  if (distanceKm <= 8) return 0            // acceptable distance
  if (distanceKm <= 15) return -10         // getting far
  if (distanceKm <= 25) return -20         // far
  return -30                               // very far - heavily penalize
}

/**
 * Extract search term by removing filler words.
 * Keeps the original query if stripping removes everything meaningful.
 */
export function extractSearchTerm(raw: string): string {
  let q = raw.toLowerCase()
  // Strip punctuation characters first
  q = q.replace(/[?!.,;:'"(){}\[\]<>\/\\]+/g, ' ')
  // Only phrases that never carry product meaning. Words like "top", "stand",
  // "new", "fine", "express", "size" are deliberately NOT here — they are real
  // product terms ("crop top", "phone stand", "new balance", "fine jewellery").
  const fillers = [
    'near me', 'around me', 'close to me', 'nearby', 'close by', 'around here',
    'in my area', 'in my city', 'in my location',
    'in lagos', 'in abuja', 'in port harcourt', 'in benin', 'in enugu', 'in kano', 'in nigeria',
    'seller', 'sellers', 'vendor near', 'shop near', 'store near',
    'cheap', 'cheapest', 'affordable', 'budget', 'low price', 'low cost',
    'best', 'top rated', 'trusted', 'reliable', 'verified',
    'where can i buy', 'who sells', 'where to buy', 'where to find',
    'where can i get', 'where can i find', 'where is', 'where are',
    'i am looking for', 'looking for', 'i need to buy', 'i need', 'i want to buy',
    'i want to find', 'i want', 'searching for', 'trying to find', 'trying to buy',
    'help me find', 'help me buy', 'show me', 'get me', 'find me',
    'right now', 'asap', 'urgent', 'today',
    'for sale', 'available',
    'please', 'kindly', 'thanks', 'thank you', 'hey', 'hi', 'hello',
  ]

  // Sort longest first so multi-word fillers match before their subsets
  const sorted = [...fillers].sort((a, b) => b.length - a.length)
  sorted.forEach((f) => {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q = q.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
  })
  const cleaned = q.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : raw.trim()
}

/**
 * Build a broad OR filter that covers both the full phrase AND each individual word.
 * This ensures we never return zero results just because a multi-word phrase didn't
 * match as a substring.
 */
function buildVendorOrFilter(term: string, words: string[]) {
  const allTerms = [...new Set([term, ...words])].filter((t) => t.length > 0)
  return allTerms.flatMap((t) => [
    { shop_name: { contains: t, mode: 'insensitive' as const } },
    { description: { contains: t, mode: 'insensitive' as const } },
    { category: { contains: t, mode: 'insensitive' as const } },
    { products: { some: { is_available: true, name: { contains: t, mode: 'insensitive' as const } } } },
    { products: { some: { is_available: true, description: { contains: t, mode: 'insensitive' as const } } } },
    { user: { full_name: { contains: t, mode: 'insensitive' as const } } },
  ])
}

function buildProductOrFilter(term: string, words: string[]) {
  const allTerms = [...new Set([term, ...words])].filter((t) => t.length > 0)
  return allTerms.flatMap((t) => [
    { name: { contains: t, mode: 'insensitive' as const } },
    { description: { contains: t, mode: 'insensitive' as const } },
    { vendor: { shop_name: { contains: t, mode: 'insensitive' as const } } },
    { vendor: { category: { contains: t, mode: 'insensitive' as const } } },
    { vendor: { user: { full_name: { contains: t, mode: 'insensitive' as const } } } },
  ])
}

function buildReelOrFilter(term: string, words: string[]) {
  const allTerms = [...new Set([term, ...words])].filter((t) => t.length > 0)
  // "#ankara" or "ankara" both match posts tagged #ankara
  const tags = [...new Set(allTerms.map((t) => normalizeTag(t)).filter(Boolean) as string[])]
  const tagFilters = tags.map((tag) => ({ hashtags: { has: tag } }))
  return [...tagFilters, ...allTerms.flatMap((t) => [
    { caption: { contains: t, mode: 'insensitive' as const } },
    { vendor: { shop_name: { contains: t, mode: 'insensitive' as const } } },
    { vendor: { category: { contains: t, mode: 'insensitive' as const } } },
    { vendor: { user: { full_name: { contains: t, mode: 'insensitive' as const } } } },
    { product: { name: { contains: t, mode: 'insensitive' as const } } },
  ])]
}

/**
 * Unified search across vendors, products, and reels.
 * Strategy:
 *   1. Run a broad OR query (full phrase + each word) — catches everything relevant
 *   2. Score every result with text-relevance + distance bonus + quality boost
 *   3. Sort descending by score
 *   4. If STILL zero results, run a last-resort fallback using only the first
 *      2-character prefix of each word (catches typos & abbreviations)
 */
export async function searchVendorsAndProducts(input: SearchInput): Promise<{
  vendors: any[]
  products: any[]
  reels: any[]
  totalVendors: number
  totalProducts: number
  totalReels: number
  extractedTerm: string
  did_you_mean?: string
}> {
  let { q, category, verified_only, min_rating, lat, lng, max_distance, limit, offset } = input

  if (typeof verified_only === 'string') {
    verified_only = (verified_only as string) === 'true'
  } else {
    verified_only = Boolean(verified_only)
  }

  const term = extractSearchTerm(q)
  const words = term
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
  const termLower = term.toLowerCase()

  console.log('[Search] q:', q, '→ term:', term, '| words:', words)

  // ── Special vendor-only browse ────────────────────────────────────────────
  const isVendorBrowse = words.length === 1 && (words[0] === 'vendor' || words[0] === 'vendors')
  if (isVendorBrowse) {
    return runVendorBrowse({ verified_only, lat, lng, limit, offset, min_rating, category, max_distance })
  }

  // ── Build WHERE clauses ───────────────────────────────────────────────────
  // One vendor filter shared by vendors, products (via vendor) and reels (via vendor),
  // so verified / rating / category filters apply consistently to every result type.
  const hasCategory = !!category && category !== 'All'
  const vendorFilter: any = {
    is_active: true,
    is_suspended: false,
    is_fraud_flagged: false,
  }
  if (verified_only) vendorFilter.user = { is_vendor_verified: true }
  if (min_rating > 0) vendorFilter.rating = { gte: min_rating }
  if (hasCategory) vendorFilter.category = { equals: category, mode: 'insensitive' }

  const vendorBaseWhere: any = { ...vendorFilter }
  const productBaseWhere: any = { is_available: true, vendor: vendorFilter }
  const reelBaseWhere: any = { is_active: true, vendor: vendorFilter }

  // Fetch enough candidates to rank the requested page (scoring happens in memory).
  const fetchTake = Math.min((offset + limit) * 3, 300)

  // Run all three queries in parallel for speed
  const [vendorsRaw, productsRaw, reelsRaw] = await Promise.all([
    prisma.vendor.findMany({
      where: {
        ...vendorBaseWhere,
        OR: buildVendorOrFilter(termLower, words),
      },
      select: {
        id: true, user_id: true, shop_name: true, description: true, category: true,
        lat: true, lng: true, logo_url: true, banner_url: true, avatar_url: true,
        address: true, phone: true, whatsapp: true, instagram: true, twitter: true,
        open_days: true, open_time: true, close_time: true, city: true,
        rating: true, review_count: true,
        user: {
          select: { id: true, full_name: true, avatar_url: true, created_at: true, is_vendor_verified: true },
        },
      },
      take: fetchTake,
    }),

    prisma.product.findMany({
      where: {
        ...productBaseWhere,
        OR: buildProductOrFilter(termLower, words),
      },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, rating: true, review_count: true,
            user: { select: { is_vendor_verified: true } },
          },
        },
      },
      take: fetchTake,
    }),

    prisma.reel.findMany({
      where: {
        ...reelBaseWhere,
        OR: buildReelOrFilter(termLower, words),
      },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, rating: true, review_count: true,
            user: { select: { is_vendor_verified: true } },
          },
        },
        product: { select: { id: true, name: true, price: true, image_url: true } },
      },
      take: fetchTake,
    }),
  ])

  // ── Fallback: if everything returned empty, retry with looser terms ────────
  // Use the shortest meaningful words (≥3 chars) as standalone queries
  let fallbackVendors: typeof vendorsRaw = []
  let fallbackProducts: typeof productsRaw = []
  let fallbackReels: typeof reelsRaw = []

  if (vendorsRaw.length === 0 && productsRaw.length === 0 && reelsRaw.length === 0) {
    console.log('[Search] Primary query returned 0 — running fallback with short tokens')
    // Fallback tokens: each word truncated to first 3 chars (catches e.g. "shoes" → "sho")
    const fallbackTokens = [...new Set(
      words
        .filter((w) => w.length >= 3)
        .map((w) => w.slice(0, 3))
    )]

    if (fallbackTokens.length > 0) {
      ;[fallbackVendors, fallbackProducts, fallbackReels] = await Promise.all([
        prisma.vendor.findMany({
          where: {
            ...vendorBaseWhere,
            OR: buildVendorOrFilter(fallbackTokens[0], fallbackTokens),
          },
          select: {
            id: true, user_id: true, shop_name: true, description: true, category: true,
            lat: true, lng: true, logo_url: true, banner_url: true, avatar_url: true,
            address: true, phone: true, whatsapp: true, instagram: true, twitter: true,
            open_days: true, open_time: true, close_time: true, city: true,
            rating: true, review_count: true,
            user: {
              select: { id: true, full_name: true, avatar_url: true, created_at: true, is_vendor_verified: true },
            },
          },
          take: fetchTake,
        }),
        prisma.product.findMany({
          where: {
            ...productBaseWhere,
            OR: buildProductOrFilter(fallbackTokens[0], fallbackTokens),
          },
          include: {
            vendor: {
              select: {
                id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
                logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
                whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
                close_time: true, city: true, rating: true, review_count: true,
                user: { select: { is_vendor_verified: true } },
              },
            },
          },
          take: fetchTake,
        }),
        prisma.reel.findMany({
          where: {
            ...reelBaseWhere,
            OR: buildReelOrFilter(fallbackTokens[0], fallbackTokens),
          },
          include: {
            vendor: {
              select: {
                id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
                logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
                whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
                close_time: true, city: true, rating: true, review_count: true,
                user: { select: { is_vendor_verified: true } },
              },
            },
            product: { select: { id: true, name: true, price: true, image_url: true } },
          },
          take: fetchTake,
        }),
      ])
    }
  }

  const finalVendors = vendorsRaw.length > 0 ? vendorsRaw : fallbackVendors
  const finalProducts = productsRaw.length > 0 ? productsRaw : fallbackProducts
  const finalReels = reelsRaw.length > 0 ? reelsRaw : fallbackReels

  // ── Score & build unified results ─────────────────────────────────────────
  const results: UnifiedSearchResult[] = []

  const categoryBoostAmount = 15

  for (const v of finalVendors) {
    const vDist =
      lat != null && lng != null && v.lat != null && v.lng != null
        ? calcDistance(lat, lng, v.lat, v.lng)
        : null

    let score =
      scoreVendor(v.shop_name, v.description, v.category, termLower, words) +
      vendorBoost(v) +
      distanceBonus(vDist)

    if (category && category !== 'All' && v.category === category) score += categoryBoostAmount

    results.push(buildVendorResult(v, score, vDist))
  }

  for (const p of finalProducts) {
    const v = p.vendor
    const vDist =
      lat != null && lng != null && v.lat != null && v.lng != null
        ? calcDistance(lat, lng, v.lat, v.lng)
        : null

    let score =
      scoreProduct(p.name, p.description, v.shop_name, termLower, words) +
      (v.user?.is_vendor_verified ? 8 : 0) +
      (v.rating >= 4.5 ? 12 : v.rating >= 4.0 ? 8 : v.rating >= 3.0 ? 4 : 0) +
      distanceBonus(vDist)

    if (category && category !== 'All' && v.category === category) score += categoryBoostAmount

    results.push(buildProductResult(p, v, score, vDist))
  }

  for (const r of finalReels) {
    const v = r.vendor
    const vDist =
      lat != null && lng != null && v.lat != null && v.lng != null
        ? calcDistance(lat, lng, v.lat, v.lng)
        : null

    let score =
      scoreReel(r.caption, v.shop_name, r.product?.name ?? null, termLower, words) +
      (v.user?.is_vendor_verified ? 8 : 0) +
      (v.rating >= 4.5 ? 12 : v.rating >= 4.0 ? 8 : v.rating >= 3.0 ? 4 : 0) +
      distanceBonus(vDist) +
      Math.min(r.like_count ?? 0, 10) // engagement boost (capped)

    if (category && category !== 'All' && v.category === category) score += categoryBoostAmount

    results.push(buildReelResult(r, v, score, vDist))
  }

  // Deduplicate by id, keep highest score
  const seen = new Map<string, UnifiedSearchResult>()
  for (const r of results) {
    const existing = seen.get(r.id)
    if (!existing || r.score > existing.score) seen.set(r.id, r)
  }

  // Apply distance filtering if max_distance is specified and location is provided
  let filteredResults = Array.from(seen.values())
  if (max_distance != null && lat != null && lng != null) {
    filteredResults = filteredResults.filter(result => {
      // Only filter results that have distance calculated
      if (result.distance === null) return false
      return result.distance <= max_distance
    })
    console.log(`[Search] Distance filter applied: ${max_distance}km - filtered from ${seen.size} to ${filteredResults.length} results`)
  }

  const sorted = filteredResults.sort((a, b) => b.score - a.score)
  const paged = sorted.slice(offset, offset + limit)

  const vendors = paged
    .filter((r) => r.type === 'vendor')
    .map((r) => mapVendorShape(r))

  const products = paged
    .filter((r) => r.type === 'product')
    .map((r) => mapProductShape(r))

  const reels = paged
    .filter((r) => r.type === 'reel')
    .map((r) => mapReelShape(r))

  console.log(
    `[Search] total scored: ${sorted.length} | returned: ${paged.length} | vendors: ${vendors.length} products: ${products.length} reels: ${reels.length}`
  )

  // ── Did you mean? ─────────────────────────────────────────────────────────────
  // Only suggest if results are sparse (less than 3 items total)
  let didYouMean: string | undefined = undefined
  if (sorted.length < 3 && words.length > 0) {
    const firstWord = words[0]
    const similar = await findSimilarTerm(firstWord)
    if (similar && similar.toLowerCase() !== firstWord.toLowerCase()) {
      didYouMean = similar
    }
  }

  return {
    vendors,
    products,
    reels,
    totalVendors: sorted.filter((r) => r.type === 'vendor').length,
    totalProducts: sorted.filter((r) => r.type === 'product').length,
    totalReels: sorted.filter((r) => r.type === 'reel').length,
    extractedTerm: term,
    did_you_mean: didYouMean,
  }
}

// ── Result builders ───────────────────────────────────────────────────────────

function buildVendorResult(v: any, score: number, distance: number | null): UnifiedSearchResult {
  return {
    id: v.id,
    type: 'vendor',
    vendor_id: v.id,
    vendor_user_id: v.user?.id ?? null,
    vendor_shop_name: v.shop_name,
    vendor_category: v.category ?? null,
    vendor_lat: v.lat,
    vendor_lng: v.lng,
    vendor_logo_url: v.logo_url,
    vendor_banner_url: v.banner_url,
    vendor_avatar_url: v.avatar_url,
    vendor_address: v.address,
    vendor_phone: v.phone,
    vendor_whatsapp: v.whatsapp,
    vendor_instagram: v.instagram,
    vendor_twitter: v.twitter,
    vendor_open_days: v.open_days,
    vendor_open_time: v.open_time,
    vendor_close_time: v.close_time,
    vendor_city: v.city,
    vendor_is_verified: v.user?.is_vendor_verified ?? null,
    vendor_rating: v.rating,
    vendor_review_count: v.review_count,
    name: v.shop_name,
    description: v.description,
    price: null,
    image_url: v.logo_url ?? null,
    video_url: null,
    thumbnail_url: null,
    product_id: null,
    score,
    distance,
  }
}

function buildProductResult(p: any, v: any, score: number, distance: number | null): UnifiedSearchResult {
  return {
    id: p.id,
    type: 'product',
    vendor_id: v.id,
    vendor_user_id: v.user_id,
    vendor_shop_name: v.shop_name,
    vendor_category: v.category ?? null,
    vendor_lat: v.lat,
    vendor_lng: v.lng,
    vendor_logo_url: v.logo_url,
    vendor_banner_url: v.banner_url,
    vendor_avatar_url: v.avatar_url,
    vendor_address: v.address,
    vendor_phone: v.phone,
    vendor_whatsapp: v.whatsapp,
    vendor_instagram: v.instagram,
    vendor_twitter: v.twitter,
    vendor_open_days: v.open_days,
    vendor_open_time: v.open_time,
    vendor_close_time: v.close_time,
    vendor_city: v.city,
    vendor_is_verified: v.user?.is_vendor_verified ?? null,
    vendor_rating: v.rating,
    vendor_review_count: v.review_count,
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.image_url,
    video_url: null,
    thumbnail_url: null,
    product_id: null,
    score,
    distance,
  }
}

function buildReelResult(r: any, v: any, score: number, distance: number | null): UnifiedSearchResult {
  return {
    id: r.id,
    type: 'reel',
    vendor_id: v.id,
    vendor_user_id: v.user_id,
    vendor_shop_name: v.shop_name,
    vendor_category: v.category ?? null,
    vendor_lat: v.lat,
    vendor_lng: v.lng,
    vendor_logo_url: v.logo_url,
    vendor_banner_url: v.banner_url,
    vendor_avatar_url: v.avatar_url,
    vendor_address: v.address,
    vendor_phone: v.phone,
    vendor_whatsapp: v.whatsapp,
    vendor_instagram: v.instagram,
    vendor_twitter: v.twitter,
    vendor_open_days: v.open_days,
    vendor_open_time: v.open_time,
    vendor_close_time: v.close_time,
    vendor_city: v.city,
    vendor_is_verified: v.user?.is_vendor_verified ?? null,
    vendor_rating: v.rating,
    vendor_review_count: v.review_count,
    name: r.caption,
    description: r.caption,
    price: r.product?.price ?? null,
    image_url: r.thumbnail_url ?? r.image_urls?.[0] ?? null,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url ?? r.image_urls?.[0] ?? null,
    media_type: r.media_type ?? 'video',
    image_count: Array.isArray(r.image_urls) ? r.image_urls.length : 0,
    product_id: r.product_id,
    score,
    distance,
  }
}

function mapVendorShape(r: UnifiedSearchResult) {
  return {
    id: r.vendor_id!,
    user_id: r.vendor_user_id,
    vendor_shop_name: r.vendor_shop_name,
    description: r.description,
    vendor_category: r.vendor_category,
    vendor_address: r.vendor_address,
    vendor_lat: r.vendor_lat,
    vendor_lng: r.vendor_lng,
    vendor_phone: r.vendor_phone,
    vendor_whatsapp: r.vendor_whatsapp,
    vendor_instagram: r.vendor_instagram,
    vendor_twitter: r.vendor_twitter,
    vendor_open_days: r.vendor_open_days,
    vendor_open_time: r.vendor_open_time,
    vendor_close_time: r.vendor_close_time,
    vendor_logo_url: r.vendor_logo_url,
    vendor_banner_url: r.vendor_banner_url,
    vendor_avatar_url: r.vendor_avatar_url,
    vendor_city: r.vendor_city,
    state: null,
    country: null,
    postal_code: null,
    vendor_is_verified: r.vendor_is_verified,
    is_active: true,
    vendor_rating: r.vendor_rating,
    vendor_review_count: r.vendor_review_count,
    created_at: new Date(),
    updated_at: new Date(),
    distance: r.distance,
    user: r.vendor_user_id
      ? { id: r.vendor_user_id, full_name: null, avatar_url: null, created_at: new Date() }
      : null,
  }
}

function mapProductShape(r: UnifiedSearchResult) {
  return {
    id: r.id,
    vendor_id: r.vendor_id!,
    name: r.name,
    description: r.description,
    price: r.price,
    image_url: r.image_url,
    vendor_shop_name: r.vendor_shop_name,
    vendor_rating: r.vendor_rating,
    vendor_review_count: r.vendor_review_count,
    vendor_lat: r.vendor_lat,
    vendor_lng: r.vendor_lng,
    distance: r.distance,
    is_available: true,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function mapReelShape(r: UnifiedSearchResult) {
  return {
    id: r.id,
    vendor_id: r.vendor_id!,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    caption: r.name,
    product_id: r.product_id,
    vendor_shop_name: r.vendor_shop_name,
    vendor_logo_url: r.vendor_logo_url,
    vendor_banner_url: r.vendor_banner_url,
    vendor_avatar_url: r.vendor_avatar_url,
    vendor_address: r.vendor_address,
    vendor_phone: r.vendor_phone,
    vendor_whatsapp: r.vendor_whatsapp,
    vendor_instagram: r.vendor_instagram,
    vendor_twitter: r.vendor_twitter,
    vendor_open_days: r.vendor_open_days,
    vendor_open_time: r.vendor_open_time,
    vendor_close_time: r.vendor_close_time,
    vendor_city: r.vendor_city,
    vendor_is_verified: r.vendor_is_verified,
    vendor_rating: r.vendor_rating,
    vendor_review_count: r.vendor_review_count,
    vendor_category: r.vendor_category,
    vendor_lat: r.vendor_lat,
    vendor_lng: r.vendor_lng,
    distance: r.distance,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

// ── Special vendor browse (when user searches "vendors") ──────────────────────

async function runVendorBrowse({
  verified_only,
  lat,
  lng,
  limit,
  offset,
  min_rating,
  category,
  max_distance,
}: {
  verified_only: boolean
  lat?: number
  lng?: number
  limit: number
  offset: number
  min_rating: number
  category?: string
  max_distance?: number
}) {
  const where: any = {
    is_active: true,
    is_suspended: false,
    is_fraud_flagged: false,
  }
  if (verified_only) where.user = { is_vendor_verified: true }
  if (min_rating > 0) where.rating = { gte: min_rating }
  if (category && category !== 'All') where.category = { equals: category, mode: 'insensitive' }
  const take = Math.min((offset + limit) * 3, 300)

  const [vendorsRaw, productsRaw, reelsRaw] = await Promise.all([
    prisma.vendor.findMany({
      where,
      select: {
        id: true, user_id: true, shop_name: true, description: true, category: true,
        lat: true, lng: true, logo_url: true, banner_url: true, avatar_url: true,
        address: true, phone: true, whatsapp: true, instagram: true, twitter: true,
        open_days: true, open_time: true, close_time: true, city: true,
        rating: true, review_count: true,
        user: { select: { id: true, full_name: true, avatar_url: true, created_at: true, is_vendor_verified: true } },
        _count: { select: { products: { where: { is_available: true } } } },
      },
      take,
    }),
    prisma.product.findMany({
      where: { is_available: true, vendor: where },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, rating: true, review_count: true,
            user: { select: { is_vendor_verified: true } },
          },
        },
      },
      take,
    }),
    prisma.reel.findMany({
      where: { is_active: true, vendor: where },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, rating: true, review_count: true,
            user: { select: { is_vendor_verified: true } },
          },
        },
        product: { select: { id: true, name: true, price: true, image_url: true } },
      },
      take,
    }),
  ])

  const results: UnifiedSearchResult[] = []

  for (const v of vendorsRaw) {
    const d = lat != null && lng != null && v.lat != null && v.lng != null
      ? calcDistance(lat, lng, v.lat, v.lng) : null
    const score =
      20 + (v.user?.is_vendor_verified ? 10 : 0) +
      Math.min(v._count?.products ?? 0, 5) * 2 + distanceBonus(d)
    results.push(buildVendorResult(v, score, d))
  }

  for (const p of productsRaw) {
    const v = p.vendor
    const d = lat != null && lng != null && v.lat != null && v.lng != null
      ? calcDistance(lat, lng, v.lat, v.lng) : null
    const score = 15 + (v.user?.is_vendor_verified ? 5 : 0) + distanceBonus(d)
    results.push(buildProductResult(p, v, score, d))
  }

  for (const r of reelsRaw) {
    const v = r.vendor
    const d = lat != null && lng != null && v.lat != null && v.lng != null
      ? calcDistance(lat, lng, v.lat, v.lng) : null
    const score = 10 + (v.user?.is_vendor_verified ? 5 : 0) + Math.min(r.like_count ?? 0, 10) + distanceBonus(d)
    results.push(buildReelResult(r, v, score, d))
  }

  const inRange = max_distance != null && lat != null && lng != null
    ? results.filter((r) => r.distance != null && r.distance <= max_distance)
    : results
  inRange.sort((a, b) => b.score - a.score)
  const paged = inRange.slice(offset, offset + limit)

  const vendors = paged.filter((r) => r.type === 'vendor').map(mapVendorShape)
  const products = paged.filter((r) => r.type === 'product').map(mapProductShape)
  const reels = paged.filter((r) => r.type === 'reel').map(mapReelShape)

  return {
    vendors,
    products,
    reels,
    totalVendors: inRange.filter((r) => r.type === 'vendor').length,
    totalProducts: inRange.filter((r) => r.type === 'product').length,
    totalReels: inRange.filter((r) => r.type === 'reel').length,
    extractedTerm: 'vendors',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smart type-ahead suggestions, blending:
 *   - the signed-in user's own matching history (most personal, shown first)
 *   - matching product names and vendors (prefix matches ranked above substring matches)
 *   - trending queries — only those searched at least twice, so a single user's
 *     private search never surfaces to other people
 */
export async function getSearchSuggestions(
  input: SuggestionInput & { userId?: string }
): Promise<{
  products: ProductSuggestion[]
  vendors: VendorSuggestion[]
  history: string[]
  trending: string[]
}> {
  const { q, limit, userId } = input
  const raw = q.trim()
  const term = extractSearchTerm(raw)
  const termLower = term.toLowerCase()
  const productSlots = Math.max(1, Math.ceil(limit * 0.4))
  const vendorSlots = Math.max(1, Math.ceil(limit * 0.3))

  const activeVendor = { is_active: true, is_suspended: false, is_fraud_flagged: false }

  const [products, vendors, userHistory, trendingHistory] = await Promise.all([
    prisma.product.findMany({
      where: {
        is_available: true,
        vendor: activeVendor,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, price: true, image_url: true, vendor_id: true },
      take: productSlots * 4,
    }),

    prisma.vendor.findMany({
      where: {
        ...activeVendor,
        OR: [
          { shop_name: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, shop_name: true, category: true, logo_url: true, rating: true },
      orderBy: { rating: 'desc' },
      take: vendorSlots * 4,
    }),

    userId
      ? prisma.searchHistory.findMany({
          where: { user_id: userId, query: { contains: raw, mode: 'insensitive' } },
          orderBy: { created_at: 'desc' },
          select: { query: true },
          take: 10,
        })
      : Promise.resolve([] as { query: string }[]),

    prisma.searchHistory.groupBy({
      by: ['query'],
      where: { query: { startsWith: raw, mode: 'insensitive' } },
      _count: { query: true },
      having: { query: { _count: { gte: 2 } } },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    }),
  ])

  // Rank: exact/prefix matches first, then substring matches, then by shorter names.
  const rank = (name: string) => {
    const n = name.toLowerCase()
    if (n === termLower) return 0
    if (n.startsWith(termLower)) return 1
    if (n.split(/\s+/).some((w) => w.startsWith(termLower))) return 2
    return 3
  }
  const sortedProducts = [...products]
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.length - b.name.length)
    .slice(0, productSlots)
  const sortedVendors = [...vendors]
    .sort((a, b) => rank(a.shop_name) - rank(b.shop_name) || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, vendorSlots)

  const historyStrings = dedupeCaseInsensitive(userHistory.map((h) => h.query)).slice(0, 3)
  const seen = new Set(historyStrings.map((h) => h.toLowerCase()))
  const trendingStrings = dedupeCaseInsensitive(trendingHistory.map((t: any) => t.query as string))
    .filter((t) => !seen.has(t.toLowerCase()))
    .slice(0, 3)

  return {
    products: sortedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      vendor_id: p.vendor_id,
    })),
    vendors: sortedVendors.map((v) => ({
      id: v.id,
      business_name: v.shop_name,
      category: v.category,
      logo_url: v.logo_url,
      rating: v.rating,
    })),
    history: historyStrings,
    trending: trendingStrings,
  }
}

function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item.trim())
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50

export async function getUserSearchHistory(userId: string, limit = 10): Promise<string[]> {
  const history = await prisma.searchHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit * 3, // over-fetch in case older rows contain case-variants
    select: { query: true },
  })
  return dedupeCaseInsensitive(history.map((h) => h.query)).slice(0, limit)
}

export async function saveSearchQuery(userId: string, query: string): Promise<void> {
  const trimmed = query.trim().replace(/\s+/g, ' ')
  if (!trimmed) return

  // Re-searching moves the query to the top instead of storing a duplicate.
  await prisma.$transaction([
    prisma.searchHistory.deleteMany({
      where: { user_id: userId, query: { equals: trimmed, mode: 'insensitive' } },
    }),
    prisma.searchHistory.create({ data: { user_id: userId, query: trimmed } }),
  ])

  // Keep only the latest MAX_HISTORY entries.
  const overflow = await prisma.searchHistory.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    skip: MAX_HISTORY,
    select: { id: true },
  })
  if (overflow.length > 0) {
    await prisma.searchHistory.deleteMany({ where: { id: { in: overflow.map((h) => h.id) } } })
  }
}

export async function clearSearchHistory(userId: string, query?: string): Promise<void> {
  await prisma.searchHistory.deleteMany({
    where: {
      user_id: userId,
      ...(query ? { query: { equals: query, mode: 'insensitive' as const } } : {}),
    },
  })
}
