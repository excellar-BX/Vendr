import prisma from '../../lib/prisma'

/**
 * Hashtags live on each reel as a lowercase string[] parsed from the caption
 * (GIN-indexed). Trending/autocomplete are computed straight from that column.
 */

export const MAX_TAGS_PER_POST = 15
const MAX_TAG_LENGTH = 40

// Letters (any language), digits and underscores; must contain at least one letter
// so "#1" or "#2024" alone don't become tags.
// A "#" only starts a tag at the beginning of a word (so "a#b" or "C#" in text don't count)
const TAG_RE = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]+)/gu

/** "Fresh #Ankara drop! #ankara #Lagos_Fashion" → ["ankara", "lagos_fashion"] */
export function extractHashtags(caption?: string | null): string[] {
  if (!caption) return []
  const seen = new Set<string>()
  for (const match of caption.matchAll(TAG_RE)) {
    const tag = normalizeTag(match[1])
    if (tag) seen.add(tag)
    if (seen.size >= MAX_TAGS_PER_POST) break
  }
  return [...seen]
}

/** Lowercase, strip "#", validate. Returns null for anything that isn't a usable tag. */
export function normalizeTag(raw?: string | null): string | null {
  if (!raw) return null
  const tag = raw.trim().replace(/^#+/, '').toLowerCase()
  if (!tag || tag.length > MAX_TAG_LENGTH) return null
  if (!/^[\p{L}\p{N}_]+$/u.test(tag)) return null
  if (!/\p{L}/u.test(tag)) return null
  return tag
}

export interface HashtagSummary {
  tag: string
  post_count: number
  view_count: number
}

/** Most-used tags on live posts in the last `days` days (falls back to all-time when quiet). */
export async function getTrendingHashtags(limit = 20, days = 14): Promise<HashtagSummary[]> {
  const take = Math.min(Math.max(limit, 1), 50)
  const recent = await prisma.$queryRaw<Array<{ tag: string; post_count: number; view_count: number }>>`
    SELECT tag, COUNT(*)::int AS post_count, COALESCE(SUM(r.view_count), 0)::int AS view_count
    FROM reels r
    JOIN vendors v ON v.id = r.vendor_id
    CROSS JOIN LATERAL unnest(r.hashtags) AS tag
    WHERE r.is_active = true
      AND v.is_suspended = false
      AND r.created_at > NOW() - make_interval(days => ${days})
    GROUP BY tag
    ORDER BY COUNT(*) DESC, SUM(r.view_count) DESC
    LIMIT ${take}
  `
  if (recent.length >= Math.min(5, take)) return recent

  const allTime = await prisma.$queryRaw<Array<{ tag: string; post_count: number; view_count: number }>>`
    SELECT tag, COUNT(*)::int AS post_count, COALESCE(SUM(r.view_count), 0)::int AS view_count
    FROM reels r
    JOIN vendors v ON v.id = r.vendor_id
    CROSS JOIN LATERAL unnest(r.hashtags) AS tag
    WHERE r.is_active = true AND v.is_suspended = false
    GROUP BY tag
    ORDER BY COUNT(*) DESC, SUM(r.view_count) DESC
    LIMIT ${take}
  `
  return allTime
}

/** Autocomplete: tags starting with `prefix`, most used first. */
export async function searchHashtags(prefix: string, limit = 10): Promise<HashtagSummary[]> {
  const tag = normalizeTag(prefix)
  if (!tag) return []
  // "_" is a LIKE wildcard — escape it so "#lagos_" doesn't match "#lagosx"
  const pattern = `${tag.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return prisma.$queryRaw<Array<{ tag: string; post_count: number; view_count: number }>>`
    SELECT tag, COUNT(*)::int AS post_count, COALESCE(SUM(r.view_count), 0)::int AS view_count
    FROM reels r
    CROSS JOIN LATERAL unnest(r.hashtags) AS tag
    WHERE r.is_active = true AND tag LIKE ${pattern}
    GROUP BY tag
    ORDER BY COUNT(*) DESC, tag ASC
    LIMIT ${Math.min(Math.max(limit, 1), 25)}
  `
}

/** Header numbers for a tag page. */
export async function getHashtagStats(rawTag: string): Promise<HashtagSummary> {
  const tag = normalizeTag(rawTag)
  if (!tag) throw { statusCode: 400, message: 'Invalid hashtag' }
  const agg = await prisma.reel.aggregate({
    where: { is_active: true, hashtags: { has: tag }, vendor: { is_suspended: false } },
    _count: { _all: true },
    _sum: { view_count: true },
  })
  return { tag, post_count: agg._count._all, view_count: agg._sum.view_count ?? 0 }
}

/**
 * One-off, idempotent: fill `hashtags` for posts created before the column existed.
 * Only touches rows whose caption has a "#" and whose hashtags are still empty.
 */
export async function backfillReelHashtags(): Promise<number> {
  const rows = await prisma.reel.findMany({
    where: { hashtags: { isEmpty: true }, caption: { contains: '#' } },
    select: { id: true, caption: true },
    take: 2000,
  })
  let updated = 0
  for (const r of rows) {
    const tags = extractHashtags(r.caption)
    if (tags.length === 0) continue
    await prisma.reel.update({ where: { id: r.id }, data: { hashtags: tags } })
    updated++
  }
  return updated
}
