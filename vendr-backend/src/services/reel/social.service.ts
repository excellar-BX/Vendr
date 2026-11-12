import prisma from '../../lib/prisma'

// Notifications are required lazily (same pattern as chat) to keep boot order simple
function notify(input: { userId: string; type: string; title: string; body: string; data?: Record<string, any> }) {
  try {
    const { createNotification } = require('../notification/notification.service')
    return createNotification(input).catch((err: any) => console.error('[Reel] notification failed:', err?.message))
  } catch (err) {
    console.error('[Reel] notification module error:', err)
  }
}

const MAX_COMMENT = 500
/** Distinct reports that auto-hide a post until someone reviews it */
export const AUTO_HIDE_REPORTS = 5
export const REPORT_REASONS = ['scam', 'fake', 'inappropriate', 'spam', 'other'] as const

// ─── Views (unique per person) ───────────────────────────────────────────────

/** Count a view once per person (anonymous viewers always count). */
export async function recordView(reelId: string, userId?: string): Promise<void> {
  if (!userId) {
    await prisma.reel.update({ where: { id: reelId }, data: { view_count: { increment: 1 } } })
    return
  }
  try {
    await prisma.$transaction([
      prisma.reelView.create({ data: { reel_id: reelId, user_id: userId } }),
      prisma.reel.update({ where: { id: reelId }, data: { view_count: { increment: 1 } } }),
    ])
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err // already counted for this person
  }
}

export async function recordShare(reelId: string): Promise<void> {
  await prisma.reel.update({ where: { id: reelId }, data: { share_count: { increment: 1 } } })
}

export async function recordChatTap(reelId: string): Promise<void> {
  await prisma.reel.update({ where: { id: reelId }, data: { chat_count: { increment: 1 } } })
}

// ─── Comments ────────────────────────────────────────────────────────────────

function serializeComment(c: any, viewerId: string | undefined, postOwnerId: string) {
  return {
    id: c.id,
    reel_id: c.reel_id,
    parent_id: c.parent_id ?? null,
    body: c.is_deleted ? '' : c.body,
    is_deleted: c.is_deleted,
    reply_count: c.reply_count,
    created_at: c.created_at.toISOString(),
    user: {
      id: c.user.id,
      name: c.user.full_name ?? 'Vendr user',
      avatar_url: c.user.avatar_url ?? null,
    },
    is_mine: !!viewerId && c.user_id === viewerId,
    /** Written by the post's owner — shown with a "Seller" badge */
    is_author: c.user_id === postOwnerId,
    /** Viewer may delete: their own comment, or any comment on their own post */
    can_delete: !!viewerId && (c.user_id === viewerId || postOwnerId === viewerId),
  }
}

async function postOwner(reelId: string) {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    select: { id: true, is_active: true, user_id: true, vendor: { select: { user_id: true, shop_name: true } } },
  })
  if (!reel) throw { statusCode: 404, message: 'Post not found' }
  return { reel, ownerId: reel.vendor.user_id }
}

/**
 * Top-level comments newest first (or a comment's replies oldest first).
 * Cursor = created_at of the last item seen.
 */
export async function listComments(reelId: string, opts: { viewerId?: string; parentId?: string; before?: string; limit?: number } = {}) {
  const { ownerId } = await postOwner(reelId)
  const take = Math.min(Math.max(opts.limit ?? 30, 1), 50)
  const isReplies = !!opts.parentId
  const cursor = opts.before ? new Date(opts.before) : null

  const rows = await prisma.reelComment.findMany({
    where: {
      reel_id: reelId,
      parent_id: opts.parentId ?? null,
      // hide deleted comments unless replies still hang off them
      OR: [{ is_deleted: false }, { reply_count: { gt: 0 } }],
      ...(cursor && !isNaN(cursor.getTime())
        ? { created_at: isReplies ? { gt: cursor } : { lt: cursor } }
        : {}),
    },
    orderBy: { created_at: isReplies ? 'asc' : 'desc' },
    take,
    include: { user: { select: { id: true, full_name: true, avatar_url: true } } },
  })
  return rows.map((c) => serializeComment(c, opts.viewerId, ownerId))
}

export async function addComment(reelId: string, userId: string, rawBody: string, parentId?: string | null) {
  const body = (rawBody ?? '').trim()
  if (!body) throw { statusCode: 400, message: 'Comment cannot be empty' }
  if (body.length > MAX_COMMENT) throw { statusCode: 400, message: `Comments can be up to ${MAX_COMMENT} characters` }

  const { reel, ownerId } = await postOwner(reelId)
  if (!reel.is_active) throw { statusCode: 404, message: 'Post not found' }

  // Replies attach to the top-level comment (one level deep, like TikTok)
  let rootId: string | null = null
  let parentAuthor: string | null = null
  if (parentId) {
    const parent = await prisma.reelComment.findUnique({ where: { id: parentId }, select: { id: true, reel_id: true, parent_id: true, user_id: true } })
    if (!parent || parent.reel_id !== reelId) throw { statusCode: 400, message: 'Invalid reply' }
    rootId = parent.parent_id ?? parent.id
    parentAuthor = parent.user_id
  }

  const [comment] = await prisma.$transaction([
    prisma.reelComment.create({
      data: { reel_id: reelId, user_id: userId, body, parent_id: rootId },
      include: { user: { select: { id: true, full_name: true, avatar_url: true } } },
    }),
    prisma.reel.update({ where: { id: reelId }, data: { comment_count: { increment: 1 } } }),
    ...(rootId ? [prisma.reelComment.update({ where: { id: rootId }, data: { reply_count: { increment: 1 } } })] : []),
  ])

  const commenter = comment.user.full_name ?? 'Someone'
  const preview = body.length > 80 ? `${body.slice(0, 77)}…` : body
  if (ownerId !== userId) {
    notify({ userId: ownerId, type: 'reel_comment', title: `${commenter} commented on your post`, body: preview, data: { reel_id: reelId, comment_id: comment.id } })
  }
  if (parentAuthor && parentAuthor !== userId && parentAuthor !== ownerId) {
    notify({ userId: parentAuthor, type: 'reel_comment', title: `${commenter} replied to you`, body: preview, data: { reel_id: reelId, comment_id: comment.id } })
  }

  return serializeComment(comment, userId, ownerId)
}

export async function deleteComment(commentId: string, userId: string) {
  const c = await prisma.reelComment.findUnique({
    where: { id: commentId },
    select: { id: true, reel_id: true, user_id: true, parent_id: true, is_deleted: true, reply_count: true, reel: { select: { vendor: { select: { user_id: true } } } } },
  })
  if (!c || c.is_deleted) return
  if (c.user_id !== userId && c.reel.vendor.user_id !== userId) throw { statusCode: 403, message: 'Not authorized' }

  await prisma.$transaction([
    // Keep the row (as "deleted") when replies hang off it; otherwise remove it
    c.reply_count > 0
      ? prisma.reelComment.update({ where: { id: c.id }, data: { is_deleted: true, body: '' } })
      : prisma.reelComment.delete({ where: { id: c.id } }),
    prisma.reel.update({ where: { id: c.reel_id }, data: { comment_count: { decrement: 1 } } }),
    ...(c.parent_id ? [prisma.reelComment.update({ where: { id: c.parent_id }, data: { reply_count: { decrement: 1 } } })] : []),
  ])
}

// ─── Following stores ────────────────────────────────────────────────────────

export async function toggleFollow(vendorId: string, userId: string): Promise<{ following: boolean; follower_count: number }> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { user_id: true, follower_count: true } })
  if (!vendor) throw { statusCode: 404, message: 'Store not found' }
  if (vendor.user_id === userId) throw { statusCode: 400, message: "You can't follow your own store" }

  const existing = await prisma.vendorFollow.findUnique({ where: { user_id_vendor_id: { user_id: userId, vendor_id: vendorId } } })
  if (existing) {
    const [, v] = await prisma.$transaction([
      prisma.vendorFollow.delete({ where: { id: existing.id } }),
      prisma.vendor.update({ where: { id: vendorId }, data: { follower_count: { decrement: 1 } }, select: { follower_count: true } }),
    ])
    return { following: false, follower_count: Math.max(0, v.follower_count) }
  }
  try {
    const [, v] = await prisma.$transaction([
      prisma.vendorFollow.create({ data: { user_id: userId, vendor_id: vendorId } }),
      prisma.vendor.update({ where: { id: vendorId }, data: { follower_count: { increment: 1 } }, select: { follower_count: true } }),
    ])
    return { following: true, follower_count: v.follower_count }
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err
    return { following: true, follower_count: vendor.follower_count }
  }
}

export async function getFollowStatus(vendorId: string, userId?: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { follower_count: true, user_id: true } })
  if (!vendor) throw { statusCode: 404, message: 'Store not found' }
  const following = userId
    ? !!(await prisma.vendorFollow.findUnique({ where: { user_id_vendor_id: { user_id: userId, vendor_id: vendorId } }, select: { id: true } }))
    : false
  return { following, follower_count: vendor.follower_count, is_own: !!userId && vendor.user_id === userId }
}

export async function getFollowedVendorIds(userId: string): Promise<string[]> {
  const rows = await prisma.vendorFollow.findMany({ where: { user_id: userId }, select: { vendor_id: true } })
  return rows.map((r) => r.vendor_id)
}

/** Tell a store's followers about a new post (fire-and-forget, capped). */
export async function notifyFollowersOfPost(vendorId: string, reelId: string, posterId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { shop_name: true } })
  const followers = await prisma.vendorFollow.findMany({ where: { vendor_id: vendorId }, select: { user_id: true }, take: 500 })
  for (const f of followers) {
    if (f.user_id === posterId) continue
    await notify({
      userId: f.user_id,
      type: 'new_post',
      title: `${vendor?.shop_name ?? 'A store you follow'} posted`,
      body: 'Tap to see their new post',
      data: { reel_id: reelId, vendor_id: vendorId },
    })
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function reportReel(reelId: string, userId: string, reason: string, details?: string | null) {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) throw { statusCode: 400, message: 'Choose a reason' }
  const { reel, ownerId } = await postOwner(reelId)
  if (ownerId === userId) throw { statusCode: 400, message: "You can't report your own post" }

  try {
    await prisma.$transaction([
      prisma.reelReport.create({ data: { reel_id: reelId, reporter_id: userId, reason, details: details?.trim().slice(0, 500) || null } }),
      prisma.reel.update({ where: { id: reelId }, data: { report_count: { increment: 1 } } }),
    ])
  } catch (err: any) {
    if (err?.code === 'P2002') return { already_reported: true }
    throw err
  }

  // Enough distinct people flagged it → hide until an admin reviews it
  const count = await prisma.reelReport.count({ where: { reel_id: reelId, status: 'open' } })
  if (count >= AUTO_HIDE_REPORTS && reel.is_active) {
    await prisma.reel.update({ where: { id: reelId }, data: { is_active: false } })
    console.warn(`[Reel] ${reelId} auto-hidden after ${count} reports`)
  }
  return { already_reported: false }
}

// ─── Insights (vendor) ───────────────────────────────────────────────────────

export async function getInsights(userId: string, vendorId?: string) {
  const stores = await prisma.vendor.findMany({
    where: { user_id: userId, ...(vendorId ? { id: vendorId } : {}) },
    select: { id: true, shop_name: true, follower_count: true },
  })
  if (stores.length === 0) throw { statusCode: 404, message: 'No store found' }
  const storeIds = stores.map((s) => s.id)

  const reels = await prisma.reel.findMany({
    where: { vendor_id: { in: storeIds } },
    orderBy: { created_at: 'desc' },
    take: 200,
    select: {
      id: true, vendor_id: true, media_type: true, thumbnail_url: true, image_urls: true, caption: true, hashtags: true,
      view_count: true, like_count: true, save_count: true, comment_count: true, share_count: true, chat_count: true,
      is_active: true, created_at: true,
    },
  })

  const totals = reels.reduce((t, r) => ({
    posts: t.posts + 1,
    views: t.views + r.view_count,
    likes: t.likes + r.like_count,
    saves: t.saves + r.save_count,
    comments: t.comments + r.comment_count,
    shares: t.shares + r.share_count,
    chats: t.chats + r.chat_count,
  }), { posts: 0, views: 0, likes: 0, saves: 0, comments: 0, shares: 0, chats: 0 })

  // Which hashtags bring the most views per post
  const tagStats = new Map<string, { posts: number; views: number }>()
  for (const r of reels) for (const t of r.hashtags) {
    const s = tagStats.get(t) ?? { posts: 0, views: 0 }
    s.posts++; s.views += r.view_count
    tagStats.set(t, s)
  }
  const top_hashtags = [...tagStats.entries()]
    .map(([tag, s]) => ({ tag, posts: s.posts, avg_views: Math.round(s.views / s.posts) }))
    .sort((a, b) => b.avg_views - a.avg_views)
    .slice(0, 8)

  return {
    stores: stores.map((s) => ({ id: s.id, name: s.shop_name, followers: s.follower_count })),
    followers: stores.reduce((n, s) => n + s.follower_count, 0),
    totals,
    engagement_rate: totals.views > 0 ? (totals.likes + totals.saves + totals.comments + totals.chats) / totals.views : 0,
    top_hashtags,
    posts: reels.map((r) => ({
      id: r.id,
      vendor_id: r.vendor_id,
      media_type: r.media_type,
      thumbnail_url: r.thumbnail_url ?? r.image_urls[0] ?? null,
      caption: r.caption,
      is_active: r.is_active,
      created_at: r.created_at.toISOString(),
      views: r.view_count,
      likes: r.like_count,
      saves: r.save_count,
      comments: r.comment_count,
      shares: r.share_count,
      chats: r.chat_count,
    })),
  }
}
