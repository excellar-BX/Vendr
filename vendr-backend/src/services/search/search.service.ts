//search.service.ts
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
 * Calculate text relevance score for a vendor result
 * Higher score = better match
 */
function scoreVendor(shopName: string, description: string | null, category: string | null, searchTerm: string, words: string[]): number {
  const nameLower = shopName.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const catLower = (category || '').toLowerCase();
  const termLower = searchTerm.toLowerCase();

  let score = 0;

  // Exact match on shop name = highest score
  if (nameLower === termLower) score += 100;
  // Starts with term = very high
  else if (nameLower.startsWith(termLower)) score += 80;
  // Contains term as whole word
  else if (nameLower.includes(' ' + termLower + ' ') || nameLower.startsWith(termLower + ' ')) score += 60;
  // Contains term anywhere
  else if (nameLower.includes(termLower)) score += 40;

  // Category match
  if (catLower.includes(termLower) || termLower.includes(catLower)) {
    score += 20;
  }

  // Description match
  if (descLower.includes(termLower)) {
    score += 15;
  }

  // Multi-word bonus: if multiple search words appear, boost score
  const wordsInName = words.filter(w => nameLower.includes(w)).length;
  if (wordsInName > 0) {
    score += wordsInName * 10;
  }

  return score;
}

/**
 * Calculate text relevance score for a product result
 */
function scoreProduct(productName: string, description: string | null, vendorShopName: string | null, searchTerm: string, words: string[]): number {
  const nameLower = productName.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const vendorLower = (vendorShopName || '').toLowerCase();
  const termLower = searchTerm.toLowerCase();

  let score = 0;

  // Exact match on product name = highest
  if (nameLower === termLower) score += 100;
  // Starts with term
  else if (nameLower.startsWith(termLower)) score += 75;
  // Contains as whole word
  else if (nameLower.includes(' ' + termLower + ' ') || nameLower.startsWith(termLower + ' ')) score += 55;
  // Contains anywhere
  else if (nameLower.includes(termLower)) score += 35;

  // Vendor name match (secondary)
  if (vendorLower.includes(termLower)) {
    score += 15;
  }

  // Description match
  if (descLower.includes(termLower)) {
    score += 10;
  }

  // Multi-word bonus
  const wordsInName = words.filter(w => nameLower.includes(w)).length;
  const wordsInDesc = words.filter(w => descLower.includes(w)).length;
  score += (wordsInName + wordsInDesc) * 8;

  return score;
}

/**
 * Calculate text relevance score for a reel result
 */
function scoreReel(caption: string | null, vendorShopName: string | null, productName: string | null, searchTerm: string, words: string[]): number {
  const captionLower = (caption || '').toLowerCase();
  const vendorLower = (vendorShopName || '').toLowerCase();
  const productLower = (productName || '').toLowerCase();
  const termLower = searchTerm.toLowerCase();

  let score = 0;

  // Caption match
  if (captionLower === termLower) score += 100;
  else if (captionLower.startsWith(termLower)) score += 75;
  else if (captionLower.includes(' ' + termLower + ' ') || captionLower.startsWith(termLower + ' ')) score += 55;
  else if (captionLower.includes(termLower)) score += 35;

  // Product name match (if reel is tagged to a product)
  if (productLower.includes(termLower)) {
    score += 25;
  }

  // Vendor name match
  if (vendorLower.includes(termLower)) {
    score += 15;
  }

  // Multi-word bonus
  const wordsInCaption = words.filter(w => captionLower.includes(w)).length;
  const wordsInProduct = words.filter(w => productLower.includes(w)).length;
  score += (wordsInCaption + wordsInProduct) * 8;

  return score;
}

/**
 * Boost score based on vendor's rating and verification status
 */
function vendorBoost(vendor: any): number {
  let boost = 0;
  if (vendor.is_verified) boost += 5;
  if (vendor.rating >= 4.5) boost += 10;
  else if (vendor.rating >= 4.0) boost += 7;
  else if (vendor.rating >= 3.0) boost += 3;
  return boost;
}

/**
 * Apply distance penalty to score (closer = higher score)
 * Returns a multiplier (0.2 to 1.0)
 */
function distanceMultiplier(distanceKm: number | null): number {
  if (distanceKm === null) return 0.8; // No location known = slight penalty
  if (distanceKm <= 2) return 1.0;   // Within 2km = no penalty
  if (distanceKm <= 5) return 0.9;   // Within 5km
  if (distanceKm <= 10) return 0.8;  // Within 10km
  if (distanceKm <= 25) return 0.6;  // Within 25km
  if (distanceKm <= 50) return 0.4;  // Within 50km
  return 0.2;                        // Beyond 50km = heavy penalty
}

/**
 * Extract search term by removing filler words
 * These are words/phrases that don't contribute to actual search meaning
 */
export function extractSearchTerm(raw: string): string {
  let q = raw.toLowerCase()
  const fillers = [
    // Location-based filler
    'near me', 'around me', 'close to me', 'nearby', 'near', 'around', 'close by',
    'in lagos', 'in abuja', 'in port harcourt', 'in benin', 'in enugu', 'in kano',
    'in nigeria', 'around here', 'close to', 'within', 'within distance',
    'in my area', 'in my city', 'in my location',

    // Vendor/shop terms (removed 'vendor' and 'vendors' for special search)
    'seller', 'sellers', 'shop', 'store', 'stores',
    'stall', 'stalls', 'stand', 'booth', 'outlet', 'outlets',
    'market', 'markets', 'mall', 'malls', 'plaza', 'centre',

    // Quality/price descriptors
    'cheap', 'cheapest', 'affordable', 'budget', 'low price', 'low cost',
    'best', 'good', 'top', 'quality', 'premium', 'expensive', 'luxury',
    'high quality', 'high-end', 'top rated', 'top notch', 'excellent',
    'deluxe', 'superior', 'fine', 'grade a', 'original', 'authentic',
    'verified', 'trusted', 'reliable', 'professional',

    // Intent phrases
    'where can i buy', 'who sells', 'where to buy', 'where to find', 'where can i get', 'where can i find',
    'where is', 'where are', 'looking for', 'i need', 'i want', 'i am looking for',
    'i want to buy', 'i want to find', 'i need to buy', 'searching for',
    'trying to find', 'trying to buy', 'help me find', 'help me buy',
    'show me', 'get me', 'find me', 'locate', 'discover',

    // Quantity/amount
    'some', 'any', 'few', 'many', 'much', 'lot of', 'lots of',
    'one', 'two', 'three', 'first', 'second', 'third',

    // Time-based
    'now', 'today', 'today only', 'tonight', 'this week', 'this weekend',
    'right now', 'immediately', 'asap', 'urgent', 'quick', 'fast',

    // Online/delivery
    'online', 'delivery', 'pickup', 'pick-up', 'store pick up',
    'home delivery', 'doorstep', 'free delivery', 'same day',
    'next day', 'express', 'shipping', 'deliver',

    // Condition
    'new', 'used', 'second hand', 'pre-owned', 'refurbished',
    'brand new', 'fairly used', 'lightly used',

    // Miscellaneous
    'for', 'for sale', 'for rent', 'to buy', 'to let', 'available',
    'all', 'everything', 'anything', 'whatever', 'anywhere',
    'please', 'kindly', 'thanks', 'thank you', 'hey', 'hi', 'hello',
    'good', 'morning', 'evening', 'afternoon',
    'size', 'sizes', 'color', 'colors', 'colour', 'colours',
    'price', 'cost', 'rate', 'amount', 'fee',
  ]
  fillers.forEach(f => { q = q.replace(new RegExp(`\\b${f}\\b`, 'gi'), '') })
  return q.replace(/\s+/g, ' ').trim() || raw.trim()
}

/**
 * Unified search across vendors and products
 * Returns a single ranked list combining both types
 */
export async function searchVendorsAndProducts(input: SearchInput): Promise<{
  vendors: any[];
  products: any[];
  reels: any[];
  totalVendors: number;
  totalProducts: number;
  totalReels: number;
  extractedTerm: string;
}> {
  // Normalize inputs to ensure correct types
  let { q, category, verified_only, min_rating, lat, lng, limit, offset } = input;
  // Properly handle boolean from query string (Zod coerce may treat "false" as truthy in some cases)
  if (typeof verified_only === 'string') {
    verified_only = verified_only === 'TRUE';
  } else {
    verified_only = Boolean(verified_only);
  }

  // Extract real search term by stripping filler words
  const term = extractSearchTerm(q)
  const words = term.split(/\s+/).filter(w => w.length > 0)
  const termLower = term.toLowerCase()

  console.log('[Search Debug] input:', JSON.stringify(input))
  console.log('[Search Debug] term:', term, 'words:', words)
  console.log('[Search Debug] category filter:', category, 'verified_only:', verified_only)

  // ── Special vendor search ─────────────────────────────────────────────────
  // If user searches for "vendor" or "vendors", show all nearby vendors with their products
  const isSpecialVendorSearch = words.length === 1 && (words[0] === 'vendor' || words[0] === 'vendors')
  
  if (isSpecialVendorSearch) {
    console.log('[Search Debug] Special vendor search detected - showing all nearby vendors')
    
    // Define user location for distance calculation
    const uLat = lat;
    const uLng = lng;
    
    // Get all active vendors, prioritized by distance
    const vendorWhere: any = { is_active: true }
    if (verified_only) {
      vendorWhere.is_verified = true
    }
    
    const vendorsRaw = await prisma.vendor.findMany({
      where: vendorWhere,
      select: {
        id: true,
        user_id: true,
        shop_name: true,
        description: true,
        category: true,
        lat: true,
        lng: true,
        logo_url: true,
        banner_url: true,
        avatar_url: true,
        address: true,
        phone: true,
        whatsapp: true,
        instagram: true,
        twitter: true,
        open_days: true,
        open_time: true,
        close_time: true,
        city: true,
        is_verified: true,
        rating: true,
        review_count: true,
        user: { select: { id: true, full_name: true, avatar_url: true, created_at: true } },
        products: {
          where: { is_available: true },
          select: { id: true, name: true, description: true, price: true, image_url: true },
        },
      },
      take: limit * 3,
    })

    // Get all products from these vendors
    const productsRaw = await prisma.product.findMany({
      where: {
        is_available: true,
        vendor: { is_active: true, ...(verified_only && { is_verified: true }) },
      },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, is_verified: true, rating: true, review_count: true,
            user: { select: { id: true, full_name: true, avatar_url: true, created_at: true } }
          }
        }
      },
      take: limit * 3,
    })

    // Get all reels from these vendors
    const reelsRaw = await prisma.reel.findMany({
      where: {
        is_active: true,
        vendor: { is_active: true, ...(verified_only && { is_verified: true }) },
      },
      include: {
        vendor: {
          select: {
            id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
            logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
            whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
            close_time: true, city: true, is_verified: true, rating: true, review_count: true,
            user: { select: { id: true, full_name: true, avatar_url: true, created_at: true } }
          }
        },
        product: {
          select: {
            id: true, name: true, price: true, image_url: true,
          }
        }
      },
      take: limit * 3,
    })

    // Build results with distance-based scoring
    const results: UnifiedSearchResult[] = []
    
    // Add vendors with distance-based scoring
    for (const v of vendorsRaw) {
      const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
        ? calcDistance(uLat, uLng, v.lat, v.lng)
        : null;

      // Base score on proximity and verification
      let baseScore = 20 // Base score for all vendors in special search
      if (v.is_verified) baseScore += 10
      if (v.products && v.products.length > 0) baseScore += Math.min(v.products.length, 5) // Boost for having products
      
      const distMult = distanceMultiplier(vDist)
      const finalScore = baseScore * distMult

      results.push({
        id: v.id,
        type: 'vendor',
        vendor_id: v.id,
        vendor_user_id: v.user.id,
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
        vendor_is_verified: v.is_verified,
        vendor_rating: v.rating,
        vendor_review_count: v.review_count,
        name: v.shop_name,
        description: v.description,
        price: null,
        image_url: v.logo_url ?? null,
        video_url: null,
        thumbnail_url: null,
        product_id: null,
        score: finalScore,
        distance: vDist,
      })
    }

    // Add products with distance-based scoring
    for (const p of productsRaw) {
      const v = p.vendor;
      const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
        ? calcDistance(uLat, uLng, v.lat, v.lng)
        : null;

      let baseScore = 15 // Base score for all products in special search
      if (v.is_verified) baseScore += 5
      if (v.rating >= 4.0) baseScore += 5

      const distMult = distanceMultiplier(vDist)
      const finalScore = baseScore * distMult

      results.push({
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
        vendor_is_verified: v.is_verified,
        vendor_rating: v.rating,
        vendor_review_count: v.review_count,
        name: p.name,
        description: p.description,
        price: p.price,
        image_url: p.image_url,
        video_url: null,
        thumbnail_url: null,
        product_id: null,
        score: finalScore,
        distance: vDist,
      })
    }

    // Add reels with distance-based scoring
    for (const r of reelsRaw) {
      const v = r.vendor;
      const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
        ? calcDistance(uLat, uLng, v.lat, v.lng)
        : null;

      let baseScore = 10 // Base score for all reels in special search
      if (v.is_verified) baseScore += 5
      if (v.rating >= 4.0) baseScore += 5
      if (r.like_count > 0) baseScore += Math.min(r.like_count, 10) // Boost for engagement

      const distMult = distanceMultiplier(vDist)
      const finalScore = baseScore * distMult

      results.push({
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
        vendor_is_verified: v.is_verified,
        vendor_rating: v.rating,
        vendor_review_count: v.review_count,
        name: r.caption,
        description: r.caption,
        price: r.product?.price ?? null,
        image_url: r.thumbnail_url,
        video_url: r.video_url,
        thumbnail_url: r.thumbnail_url,
        product_id: r.product_id,
        score: finalScore,
        distance: vDist,
      })
    }

    // Sort by score (distance + relevance) and limit
    results.sort((a, b) => b.score - a.score)
    const finalResults = results.slice(0, limit)

    // Separate vendors, products, and reels for response
    const vendors = finalResults.filter(r => r.type === 'vendor')
    const products = finalResults.filter(r => r.type === 'product')
    const reels = finalResults.filter(r => r.type === 'reel')

    console.log(`[Search Debug] Special vendor search: ${vendors.length} vendors, ${products.length} products, ${reels.length} reels`)

    // Map vendors to keep vendor_ prefix for frontend consistency
    const mappedVendors = vendors.map(r => ({
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
      user: r.vendor_user_id ? {
        id: r.vendor_user_id,
        full_name: null,
        avatar_url: null,
        created_at: new Date(),
      } : null,
    }))

    return {
      vendors: mappedVendors,
      products,
      reels,
      totalVendors: vendors.length,
      totalProducts: products.length,
      totalReels: reels.length,
      extractedTerm: 'vendors',
    }
  }

  // ── Regular search continues below ───────────────────────────────────────
  const vendorWhere: any = { is_active: true }
  const vendorAnd: any[] = []

  if (words.length > 0) {
    vendorAnd.push({
      OR: words.flatMap(word => [
        { shop_name: { contains: word, mode: 'insensitive' } },
        { description: { contains: word, mode: 'insensitive' } },
        { category: { contains: word, mode: 'insensitive' } },
        // Search in product names and descriptions
        { products: { some: { is_available: true, name: { contains: word, mode: 'insensitive' } } } },
        { products: { some: { is_available: true, description: { contains: word, mode: 'insensitive' } } } },
        // Also search in user's full name (vendor owner)
        { user: { full_name: { contains: word, mode: 'insensitive' } } },
      ])
    })
  }

  if (verified_only) {
    vendorAnd.push({ is_verified: true })
  }
  if (min_rating > 0) {
    vendorAnd.push({ rating: { gte: min_rating } })
  }

  if (vendorAnd.length > 0) vendorWhere.AND = vendorAnd

  console.log('[Search Debug] Final vendorWhere:', JSON.stringify(vendorWhere, null, 2))

  const totalVendors = await prisma.vendor.count({ where: vendorWhere })

  // Fetch vendors with products for scoring
  const VENDOR_FETCH_MULT = 3
  const vendorsRaw = await prisma.vendor.findMany({
    where: vendorWhere,
    select: {
      id: true,
      user_id: true,
      shop_name: true,
      description: true,
      category: true,
      lat: true,
      lng: true,
      logo_url: true,
      banner_url: true,
      avatar_url: true,
      address: true,
      phone: true,
      whatsapp: true,
      instagram: true,
      twitter: true,
      open_days: true,
      open_time: true,
      close_time: true,
      city: true,
      is_verified: true,
      rating: true,
      review_count: true,
      user: { select: { id: true, full_name: true, avatar_url: true, created_at: true } },
      products: {
        where: { is_available: true },
        select: { id: true, name: true, description: true, price: true, image_url: true },
      },
    },
    take: limit * VENDOR_FETCH_MULT,
  })

  // ── Product query ───────────────────────────────────────────────────────
  const productWhere: any = {
    is_available: true,
    vendor: { is_active: true },
  }

  const productAnd: any[] = []
  if (words.length > 0) {
    productAnd.push({
      OR: words.flatMap(word => [
        { name: { contains: word, mode: 'insensitive' } },
        { description: { contains: word, mode: 'insensitive' } },
        // Also search by the vendor's store name and owner name
        { vendor: { shop_name: { contains: word, mode: 'insensitive' } } },
        { vendor: { user: { full_name: { contains: word, mode: 'insensitive' } } } },
      ])
    })
  }
  
  // Category filter should be optional - boost in scoring instead of filtering
  // if (category && category !== 'All') {
  //   productAnd.push({ vendor: { category } })
  // }

  if (productAnd.length > 0) productWhere.AND = productAnd

  const totalProducts = await prisma.product.count({ where: productWhere })

  const productsRaw = await prisma.product.findMany({
    where: productWhere,
    include: {
      vendor: {
        select: {
          id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
          logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
          whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
          close_time: true, city: true, is_verified: true, rating: true, review_count: true,
        },
      },
    },
    take: limit * VENDOR_FETCH_MULT,
  })

  // ── Reel query ─────────────────────────────────────────────────────────
  const reelWhere: any = {
    is_active: true,
    vendor: { is_active: true },
  }

  const reelAnd: any[] = []
  if (words.length > 0) {
    reelAnd.push({
      OR: words.flatMap(word => [
        { caption: { contains: word, mode: 'insensitive' } },
        { vendor: { shop_name: { contains: word, mode: 'insensitive' } } },
        { vendor: { user: { full_name: { contains: word, mode: 'insensitive' } } } },
        { product: { name: { contains: word, mode: 'insensitive' } } },
      ])
    })
  }

  if (reelAnd.length > 0) reelWhere.AND = reelAnd

  const totalReels = await prisma.reel.count({ where: reelWhere })

  const reelsRaw = await prisma.reel.findMany({
    where: reelWhere,
    include: {
      vendor: {
        select: {
          id: true, user_id: true, shop_name: true, category: true, lat: true, lng: true,
          logo_url: true, banner_url: true, avatar_url: true, address: true, phone: true,
          whatsapp: true, instagram: true, twitter: true, open_days: true, open_time: true,
          close_time: true, city: true, is_verified: true, rating: true, review_count: true,
        },
      },
      product: {
        select: {
          id: true, name: true, price: true, image_url: true,
        }
      }
    },
    take: limit * VENDOR_FETCH_MULT,
  })

  // ── Score & build unified results ──────────────────────────────────────
  const uLat = lat;
  const uLng = lng;

  const results: UnifiedSearchResult[] = [];

  // Score vendors
  for (const v of vendorsRaw) {
    const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
      ? calcDistance(uLat, uLng, v.lat, v.lng)
      : null;

    let baseScore = scoreVendor(v.shop_name, v.description, v.category, termLower, words) + vendorBoost(v);

    // Boost score if vendor matches selected category (TikTok-style ranking)
    if (category && category !== 'All' && v.category === category) {
      baseScore += 15; // Significant boost for category matches
    }

    const distMult = distanceMultiplier(vDist);
    const finalScore = baseScore * distMult;

    results.push({
      id: v.id,
      type: 'vendor',
      vendor_id: v.id,
      vendor_user_id: v.user.id,
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
      vendor_is_verified: v.is_verified,
      vendor_rating: v.rating,
      vendor_review_count: v.review_count,
      name: v.shop_name,
      description: v.description,
      price: null,
      image_url: v.logo_url ?? null,
      video_url: null,
      thumbnail_url: null,
      product_id: null,
      score: finalScore,
      distance: vDist,
    });
  }

  // Score products
  for (const p of productsRaw) {
    const v = p.vendor;
    const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
      ? calcDistance(uLat, uLng, v.lat, v.lng)
      : null;

    const baseScore = scoreProduct(p.name, p.description, v.shop_name, termLower, words);
    const vendorV = v.is_verified ? 5 : 0;
    const ratingB = v.rating >= 4.5 ? 10 : v.rating >= 4.0 ? 7 : v.rating >= 3.0 ? 3 : 0;

    // Boost score if product vendor matches selected category (TikTok-style ranking)
    let categoryBoost = 0;
    if (category && category !== 'All' && v.category === category) {
      categoryBoost = 15; // Significant boost for category matches
    }

    const distMult = distanceMultiplier(vDist);
    const finalScore = (baseScore + vendorV + ratingB + categoryBoost) * distMult;

    results.push({
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
      vendor_is_verified: v.is_verified,
      vendor_rating: v.rating,
      vendor_review_count: v.review_count,
      name: p.name,
      description: p.description,
      price: p.price,
      image_url: p.image_url,
      video_url: null,
      thumbnail_url: null,
      product_id: null,
      score: finalScore,
      distance: vDist,
    });
  }

  // Score reels
  for (const r of reelsRaw) {
    const v = r.vendor;
    const vDist = (uLat != null && v.lat != null && uLng != null && v.lng != null)
      ? calcDistance(uLat, uLng, v.lat, v.lng)
      : null;

    const baseScore = scoreReel(r.caption, v.shop_name, r.product?.name ?? null, termLower, words);
    const vendorV = v.is_verified ? 5 : 0;
    const ratingB = v.rating >= 4.5 ? 10 : v.rating >= 4.0 ? 7 : v.rating >= 3.0 ? 3 : 0;

    // Boost score if reel vendor matches selected category
    let categoryBoost = 0;
    if (category && category !== 'All' && v.category === category) {
      categoryBoost = 15;
    }

    // Engagement boost
    const engagementBoost = Math.min(r.like_count, 10);

    const distMult = distanceMultiplier(vDist);
    const finalScore = (baseScore + vendorV + ratingB + categoryBoost + engagementBoost) * distMult;

    results.push({
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
      vendor_is_verified: v.is_verified,
      vendor_rating: v.rating,
      vendor_review_count: v.review_count,
      name: r.caption,
      description: r.caption,
      price: r.product?.price ?? null,
      image_url: r.thumbnail_url,
      video_url: r.video_url,
      thumbnail_url: r.thumbnail_url,
      product_id: r.product_id,
      score: finalScore,
      distance: vDist,
    });
  }

  // ── Deduplicate & sort ─────────────────────────────────────────────────
  const seen = new Map<string, UnifiedSearchResult>();
  for (const r of results) {
    const existing = seen.get(r.id);
    if (!existing || r.score > existing.score) {
      seen.set(r.id, r);
    }
  }
  const uniqueResults = Array.from(seen.values());

  uniqueResults.sort((a, b) => b.score - a.score);

  const paged = uniqueResults.slice(offset, offset + limit);

  // Split into vendors and products arrays for frontend convenience
  const vendors = paged
    .filter(r => r.type === 'vendor')
    .map(r => ({
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
      distance: r.distance, // include computed distance
      user: r.vendor_user_id ? {
        id: r.vendor_user_id,
        full_name: null,
        avatar_url: null,
        created_at: new Date(),
      } : null,
    }));

  const products = paged
    .filter(r => r.type === 'product')
    .map(r => ({
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
    }));

  const reels = paged
    .filter(r => r.type === 'reel')
    .map(r => ({
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
    }));

  console.log('[Search Debug] unified results:', uniqueResults.length, 'returned:', paged.length, '| vendors:', vendors.length, 'products:', products.length, 'reels:', reels.length);
  // Debug first vendor if exists
  if (vendors.length > 0) {
    console.log('[Search Debug] First vendor sample:', JSON.stringify(vendors[0], null, 2));
  }

  return {
    vendors,
    products,
    reels,
    totalVendors,
    totalProducts,
    totalReels,
    extractedTerm: term,
  };
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

  // Get product suggestions (limited) - only from active vendors
  const products = await prisma.product.findMany({
    where: {
      is_available: true,
      vendor: { is_active: true },
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
      business_name: v.shop_name,
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
 * If query is provided, deletes only entries matching that query.
 * If query is omitted, deletes all history for the user.
 */
export async function clearSearchHistory(userId: string, query?: string): Promise<void> {
  await prisma.searchHistory.deleteMany({
    where: { user_id: userId, ...(query ? { query } : {}) }
  })
}
