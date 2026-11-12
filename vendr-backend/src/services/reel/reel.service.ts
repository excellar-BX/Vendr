import prisma from '../../lib/prisma'
import { deleteFiles } from '../storage/storage.service'
import type { CreateReInput, ReelOutput, ReelEnriched, ToggleResponse, UpdateReelInput } from './reel.schema'
import { REEL_EDIT_WINDOW_MS } from './reel.schema'
import { extractHashtags, normalizeTag } from './hashtag.service'
import { getFollowedVendorIds, notifyFollowersOfPost, recordView } from './social.service'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Every reel query loads the same relations so outputs are always complete
const reelInclude = {
  vendor: { include: { user: { select: { is_vendor_verified: true } } } },
  product: true,
} as const

/** Base fields shared by every reel output (video and photo posts). */
function serializeReel(r: any): ReelOutput {
  const mediaType = r.media_type === 'photo' ? 'photo' : 'video'
  const imageUrls: string[] = Array.isArray(r.image_urls) ? r.image_urls : []
  return {
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    media_type: mediaType,
    video_url: r.video_url ?? null,
    image_urls: imageUrls,
    // Grids/cards only know thumbnail_url — photo posts fall back to their first photo
    thumbnail_url: r.thumbnail_url ?? imageUrls[0] ?? null,
    caption: r.caption ?? null,
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    product_id: r.product_id ?? null,
    view_count: r.view_count,
    like_count: r.like_count,
    save_count: r.save_count,
    comment_count: r.comment_count ?? 0,
    share_count: r.share_count ?? 0,
    is_active: r.is_active,
    created_at: r.created_at.toISOString(),
    edited_at: r.edited_at ? r.edited_at.toISOString() : null,
    editable_until: new Date(r.created_at.getTime() + REEL_EDIT_WINDOW_MS).toISOString(),
  }
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function enrichReels(
  reels: any[],
  userId?: string,
  origin?: { lat: number; lng: number } | null
): Promise<ReelEnriched[]> {
  const enriched: ReelEnriched[] = reels.map(r => ({
    ...serializeReel(r),
    vendor: r.vendor ? {
      user_id: r.vendor.user_id ?? null,
      business_name: r.vendor.shop_name ?? null,
      logo_url: r.vendor.logo_url ?? null,
      // was undefined when the user relation wasn't loaded, which failed the
      // strict output schema and turned GET /reels/:id into a 500
      is_verified: r.vendor.user?.is_vendor_verified ?? false,
      category: r.vendor.category ?? null,
      follower_count: r.vendor.follower_count ?? 0,
      city: r.vendor.city ?? null,
    } : null,
    product: r.product ? {
      name: r.product.name ?? null,
      price: r.product.price ?? null,
      image_url: r.product.image_url ?? null,
    } : null,
    distance_km: origin && r.vendor?.lat != null && r.vendor?.lng != null
      ? Math.round(distanceKm(origin.lat, origin.lng, r.vendor.lat, r.vendor.lng) * 10) / 10
      : null,
    is_liked: false,
    is_saved: false,
    is_following: false,
  }))

  if (!userId || enriched.length === 0) {
    return enriched
  }

  const reelIds = enriched.map(e => e.id)
  const vendorIds = [...new Set(enriched.map(e => e.vendor_id))]
  const [likedRows, savedRows, followRows] = await Promise.all([
    prisma.reelLike.findMany({ where: { user_id: userId, reel_id: { in: reelIds } }, select: { reel_id: true } }),
    prisma.reelSave.findMany({ where: { user_id: userId, reel_id: { in: reelIds } }, select: { reel_id: true } }),
    prisma.vendorFollow.findMany({ where: { user_id: userId, vendor_id: { in: vendorIds } }, select: { vendor_id: true } }),
  ])

  const likedSet = new Set(likedRows.map((l: any) => l.reel_id))
  const savedSet = new Set(savedRows.map((s: any) => s.reel_id))
  const followSet = new Set(followRows.map((f: any) => f.vendor_id))

  return enriched.map(e => ({
    ...e,
    is_liked: likedSet.has(e.id),
    is_saved: savedSet.has(e.id),
    is_following: followSet.has(e.vendor_id),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Public / Feed
// ─────────────────────────────────────────────────────────────────────────────

// Cheap stable hash -> 0..1 (daily shuffle so the feed isn't identical every visit)
function jitter(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * Reels feed.
 *  - "following": posts from stores you follow, newest first
 *  - "for_you" (default): ranked: fresh, engaging, nearby and followed stores first;
 *    posts you've already watched sink; the same store never shows twice in a row.
 */
export async function getReelFeed(params: {
  userId?: string
  limit?: number
  offset?: number
  mode?: 'for_you' | 'following'
  lat?: number | null
  lng?: number | null
} = {}): Promise<ReelEnriched[]> {
  const { userId, mode = 'for_you' } = params
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)
  const offset = Math.max(params.offset ?? 0, 0)
  const origin = params.lat != null && params.lng != null && isFinite(params.lat) && isFinite(params.lng)
    ? { lat: params.lat, lng: params.lng }
    : null
  const live = { is_active: true, vendor: { is_suspended: false } }

  if (mode === 'following') {
    if (!userId) return []
    const followed = await getFollowedVendorIds(userId)
    if (followed.length === 0) return []
    const reels = await prisma.reel.findMany({
      where: { ...live, vendor_id: { in: followed } },
      include: reelInclude,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    })
    return enrichReels(reels, userId, origin)
  }

  // Candidate pool: recent posts (widen to all-time if the app is quiet)
  const since = new Date(Date.now() - 45 * 86_400_000)
  let pool = await prisma.reel.findMany({
    where: { ...live, created_at: { gte: since } },
    include: reelInclude,
    orderBy: { created_at: 'desc' },
    take: 400,
  })
  if (pool.length < 40) {
    pool = await prisma.reel.findMany({ where: live, include: reelInclude, orderBy: { created_at: 'desc' }, take: 400 })
  }
  if (pool.length === 0) return []

  const [followed, seenRows] = userId
    ? await Promise.all([
        getFollowedVendorIds(userId),
        prisma.reelView.findMany({ where: { user_id: userId, reel_id: { in: pool.map(r => r.id) } }, select: { reel_id: true } }),
      ])
    : [[] as string[], [] as Array<{ reel_id: string }>]
  const followedSet = new Set(followed)
  const seen = new Set(seenRows.map(r => r.reel_id))
  const day = new Date().toISOString().slice(0, 10)
  const now = Date.now()

  const scored = pool.map((r: any) => {
    const ageHours = (now - r.created_at.getTime()) / 3_600_000
    let score = 40 * Math.exp(-ageHours / 72)                        // freshness
    const engagement = (r.like_count + 2 * r.save_count + 2 * (r.comment_count ?? 0) + 3 * (r.chat_count ?? 0) + 2 * (r.share_count ?? 0)) / (r.view_count + 20)
    score += Math.min(engagement * 120, 30)                          // people interact with it
    score += Math.log10(r.view_count + 1) * 3                        // proven reach
    if (origin && r.vendor?.lat != null && r.vendor?.lng != null) {   // close to you
      const d = distanceKm(origin.lat, origin.lng, r.vendor.lat, r.vendor.lng)
      score += d < 3 ? 25 : d < 10 ? 18 : d < 30 ? 10 : d < 100 ? 4 : 0
    }
    if (followedSet.has(r.vendor_id)) score += 18                    // you follow the store
    if (r.vendor?.user?.is_vendor_verified) score += 4
    score += jitter(`${userId ?? 'anon'}:${r.id}:${day}`) * 8        // a little daily variety
    if (seen.has(r.id)) score *= 0.25                                // already watched -> later
    if (userId && r.user_id === userId) score *= 0.5                 // your own posts less often
    return { r, score }
  }).sort((a, b) => b.score - a.score)

  // Don't show the same store twice in a row
  const ordered: typeof scored = []
  const rest = [...scored]
  while (rest.length) {
    const prevVendor = ordered[ordered.length - 1]?.r.vendor_id
    const idx = rest.findIndex(x => x.r.vendor_id !== prevVendor)
    ordered.push(...rest.splice(idx === -1 ? 0 : idx, 1))
  }

  const page = ordered.slice(offset, offset + limit).map(x => x.r)
  return enrichReels(page, userId, origin)
}

/**
 * Posts with a hashtag (tag page), newest first.
 */
export async function getReelsByHashtag(
  rawTag: string,
  params: { userId?: string; limit?: number; offset?: number } = {}
): Promise<ReelEnriched[]> {
  const tag = normalizeTag(rawTag)
  if (!tag) return []
  const { userId, limit = 20, offset = 0 } = params
  const reels = await prisma.reel.findMany({
    where: { is_active: true, hashtags: { has: tag }, vendor: { is_suspended: false } },
    include: reelInclude,
    orderBy: { created_at: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    skip: Math.max(offset, 0),
  })
  return enrichReels(reels, userId)
}

/**
 * Get reels by vendor_id.
 * includeAll (inactive reels too) is honoured only for the vendor's owner.
 */
export async function getReelsByVendor(
  vendorId: string,
  params: {
    includeAll?: boolean
    userId?: string
    limit?: number
    offset?: number
  } = {}
): Promise<ReelEnriched[]> {
  const { includeAll = false, userId, limit = 20, offset = 0 } = params

  let showInactive = false
  if (includeAll && userId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { user_id: true } })
    showInactive = vendor?.user_id === userId
  }

  const reels = await prisma.reel.findMany({
    where: { vendor_id: vendorId, ...(showInactive ? {} : { is_active: true }) },
    include: reelInclude,
    orderBy: { created_at: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    skip: Math.max(offset, 0),
  })

  return enrichReels(reels, userId)
}

/**
 * Get single reel by ID with enriched data
 */
export async function getReelById(
  reelId: string,
  userId?: string
): Promise<ReelEnriched> {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    include: reelInclude,
  })

  if (!reel || (!reel.is_active && reel.user_id !== userId)) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

  const [enriched] = await enrichReels([reel], userId)
  return enriched!
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions (Like/Save) — atomic so counts never drift on double taps
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleLike(
  reelId: string,
  userId: string
): Promise<ToggleResponse> {
  const existing = await prisma.reelLike.findUnique({
    where: { user_id_reel_id: { user_id: userId, reel_id: reelId } },
  })

  if (existing) {
    await prisma.$transaction([
      prisma.reelLike.delete({ where: { id: existing.id } }),
      prisma.reel.update({ where: { id: reelId }, data: { like_count: { decrement: 1 } } }),
    ])
    return { liked: false }
  }

  try {
    await prisma.$transaction([
      prisma.reelLike.create({ data: { user_id: userId, reel_id: reelId } }),
      prisma.reel.update({ where: { id: reelId }, data: { like_count: { increment: 1 } } }),
    ])
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err // a racing double tap already liked it
  }
  return { liked: true }
}

export async function toggleSave(
  reelId: string,
  userId: string
): Promise<ToggleResponse> {
  const existing = await prisma.reelSave.findUnique({
    where: { user_id_reel_id: { user_id: userId, reel_id: reelId } },
  })

  if (existing) {
    await prisma.$transaction([
      prisma.reelSave.delete({ where: { id: existing.id } }),
      prisma.reel.update({ where: { id: reelId }, data: { save_count: { decrement: 1 } } }),
    ])
    return { saved: false }
  }

  try {
    await prisma.$transaction([
      prisma.reelSave.create({ data: { user_id: userId, reel_id: reelId } }),
      prisma.reel.update({ where: { id: reelId }, data: { save_count: { increment: 1 } } }),
    ])
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err
  }
  return { saved: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor-facing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get reels by vendor_id (legacy - returns basic ReelOutput)
 */
export async function getReelsByVendorBasic(
  vendorId: string,
  includeAll: boolean = false
): Promise<ReelOutput[]> {
  const reels = await prisma.reel.findMany({
    where: { vendor_id: vendorId, ...(includeAll ? {} : { is_active: true }) },
    orderBy: { created_at: 'desc' },
  })
  return reels.map(serializeReel)
}

/**
 * Create a new reel (video, or a swipeable stack of photos) for the vendor
 */
export async function createReel(
  userId: string,
  input: CreateReInput
): Promise<ReelOutput> {
  // A user can own several stores. Work out which one this post belongs to:
  //   tagged product → that product's store; else the requested store; else their first store.
  const myStores = await prisma.vendor.findMany({
    where: { user_id: userId },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  })
  if (myStores.length === 0) {
    throw { statusCode: 404, message: 'Vendor not found. Become a vendor first.' }
  }
  const myStoreIds = new Set(myStores.map(v => v.id))

  let storeId = input.vendor_id && myStoreIds.has(input.vendor_id) ? input.vendor_id : myStores[0].id
  if (input.vendor_id && !myStoreIds.has(input.vendor_id)) {
    throw { statusCode: 403, message: "You can only post to your own stores" }
  }

  if (input.product_id) {
    const product = await prisma.product.findUnique({ where: { id: input.product_id }, select: { vendor_id: true } })
    if (!product || !myStoreIds.has(product.vendor_id)) {
      throw { statusCode: 400, message: 'That product isn’t in any of your stores' }
    }
    storeId = product.vendor_id
  }
  const vendor = { id: storeId }

  const isPhoto = input.media_type === 'photo'
  const imageUrls = isPhoto ? input.image_urls : []

  const reel = await prisma.reel.create({
    data: {
      vendor_id: vendor.id,
      user_id: userId,
      media_type: isPhoto ? 'photo' : 'video',
      video_url: isPhoto ? null : input.video_url,
      image_urls: imageUrls,
      thumbnail_url: input.thumbnail_url ?? (isPhoto ? imageUrls[0] : null),
      caption: input.caption?.trim() || null,
      hashtags: extractHashtags(input.caption),
      product_id: input.product_id ?? null,
    },
  })

  notifyFollowersOfPost(reel.vendor_id, reel.id, userId).catch(err =>
    console.error('[Reel] follower notifications failed:', err?.message)
  )

  return serializeReel(reel)
}

/**
 * Edit a post's caption (hashtags follow) and tagged product.
 * Owner only, and only within 15 minutes of posting — after that it's locked.
 */
export async function updateReel(
  reelId: string,
  userId: string,
  input: UpdateReelInput
): Promise<ReelEnriched> {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    select: { id: true, vendor_id: true, user_id: true, created_at: true, vendor: { select: { user_id: true } } },
  })
  if (!reel) throw { statusCode: 404, message: 'Post not found' }
  if (reel.vendor.user_id !== userId && reel.user_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }
  if (Date.now() - reel.created_at.getTime() > REEL_EDIT_WINDOW_MS) {
    throw { statusCode: 403, message: 'Posts can only be edited within 15 minutes of posting.' }
  }

  const data: any = { edited_at: new Date() }
  if (input.caption !== undefined) {
    data.caption = input.caption?.trim() || null
    data.hashtags = extractHashtags(input.caption)
  }
  if (input.product_id !== undefined) {
    if (input.product_id) {
      // The tag must be one of this post's store's products
      const product = await prisma.product.findUnique({ where: { id: input.product_id }, select: { vendor_id: true } })
      if (!product || product.vendor_id !== reel.vendor_id) {
        throw { statusCode: 400, message: 'You can only tag products from the store this was posted to' }
      }
    }
    data.product_id = input.product_id || null
  }

  await prisma.reel.update({ where: { id: reelId }, data })
  return getReelById(reelId, userId)
}

/**
 * Increment view count for a reel
 */
export async function incrementReelViewCount(reelId: string, userId?: string): Promise<void> {
  await recordView(reelId, userId)
}

/**
 * Get reels saved by a user (with full reel details)
 */
export async function getSavedReels(
  userId: string
): Promise<ReelEnriched[]> {
  const savedReels = await prisma.reelSave.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    include: { reel: { include: reelInclude } },
  })

  // Hide reels that were taken down since they were saved
  const reels = savedReels.map(s => s.reel).filter(r => r.is_active)
  return enrichReels(reels, userId)
}

/**
 * Delete reel (vendor only, ownership enforced)
 * Also deletes associated files (video, thumbnail, every photo) from R2 storage
 */
export async function deleteReel(
  reelId: string,
  userId: string
): Promise<void> {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId }
  })

  if (!reel) {
    throw { statusCode: 404, message: 'Reel not found' }
  }

  // Any of the user's stores (was: only their first store, so other stores' posts couldn't be deleted)
  const owner = await prisma.vendor.findFirst({
    where: { id: reel.vendor_id, user_id: userId },
    select: { id: true },
  })
  if (!owner && reel.user_id !== userId) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const filesToDelete = new Set<string>()
  if (reel.video_url) filesToDelete.add(reel.video_url)
  if (reel.thumbnail_url) filesToDelete.add(reel.thumbnail_url)
  for (const url of reel.image_urls ?? []) filesToDelete.add(url)

  if (filesToDelete.size > 0) {
    try {
      await deleteFiles([...filesToDelete])
    } catch (err) {
      console.error('Failed to delete storage files:', err)
      // Continue with DB deletion even if storage fails
    }
  }

  await prisma.reel.delete({ where: { id: reelId } })
}
