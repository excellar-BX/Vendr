import { FastifyInstance } from 'fastify'
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate'
import {
  getReelsController,
  createReelController,
  getReelController,
  deleteReelController,
  updateReelController,
  incrementViewController,
  getSavedReelsController,
  toggleLikeController,
  toggleSaveController,
} from './reel.controller'

import { getTrendingHashtags, searchHashtags, getHashtagStats } from './hashtag.service'

import * as Social from './social.service'

const fail = (reply: any, err: any, tag: string) => {
  if (!err?.statusCode) console.error(`[Reel] ${tag} error:`, err)
  return reply.status(err?.statusCode ?? 500).send({ success: false, message: err?.message ?? 'Something went wrong' })
}

export async function reelRoutes(app: FastifyInstance) {
  // ── Comments ──────────────────────────────────────────────────────────────
  app.get('/reels/:id/comments', { preHandler: optionalAuthenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { parent_id, before, limit } = request.query as { parent_id?: string; before?: string; limit?: string }
      const data = await Social.listComments(id, {
        viewerId: request.user?.id, parentId: parent_id || undefined, before, limit: limit ? parseInt(limit, 10) : undefined,
      })
      return reply.send({ success: true, data })
    } catch (err) { return fail(reply, err, 'listComments') }
  })

  app.post('/reels/:id/comments', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { body, parent_id } = (request.body ?? {}) as { body?: string; parent_id?: string | null }
      const data = await Social.addComment(id, request.user.id, body ?? '', parent_id)
      return reply.status(201).send({ success: true, data })
    } catch (err) { return fail(reply, err, 'addComment') }
  })

  app.delete('/reel-comments/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await Social.deleteComment(id, request.user.id)
      return reply.send({ success: true })
    } catch (err) { return fail(reply, err, 'deleteComment') }
  })

  // ── Reporting ─────────────────────────────────────────────────────────────
  app.post('/reels/:id/report', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { reason, details } = (request.body ?? {}) as { reason?: string; details?: string }
      const data = await Social.reportReel(id, request.user.id, reason ?? '', details)
      return reply.status(201).send({ success: true, data })
    } catch (err) { return fail(reply, err, 'report') }
  })

  // ── Engagement counters (insights) ────────────────────────────────────────
  app.post('/reels/:id/share', { preHandler: optionalAuthenticate }, async (request, reply) => {
    try {
      await Social.recordShare((request.params as { id: string }).id)
      return reply.send({ success: true })
    } catch (err) { return fail(reply, err, 'share') }
  })

  app.post('/reels/:id/chat', { preHandler: optionalAuthenticate }, async (request, reply) => {
    try {
      await Social.recordChatTap((request.params as { id: string }).id)
      return reply.send({ success: true })
    } catch (err) { return fail(reply, err, 'chatTap') }
  })

  // ── Vendor insights ───────────────────────────────────────────────────────
  app.get('/reels/insights', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { vendor_id } = request.query as { vendor_id?: string }
      const data = await Social.getInsights(request.user.id, vendor_id || undefined)
      return reply.send({ success: true, data })
    } catch (err) { return fail(reply, err, 'insights') }
  })

  // ── Following stores ──────────────────────────────────────────────────────
  app.get('/vendors/:id/follow', { preHandler: optionalAuthenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = await Social.getFollowStatus(id, request.user?.id)
      return reply.send({ success: true, data })
    } catch (err) { return fail(reply, err, 'followStatus') }
  })

  app.post('/vendors/:id/follow', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = await Social.toggleFollow(id, request.user.id)
      return reply.send({ success: true, data })
    } catch (err) { return fail(reply, err, 'follow') }
  })

  // ── Hashtags ──────────────────────────────────────────────────────────────
  app.get('/hashtags/trending', async (request, reply) => {
    try {
      const { limit } = request.query as { limit?: string }
      const data = await getTrendingHashtags(limit ? parseInt(limit, 10) || 20 : 20)
      return reply.send({ success: true, data })
    } catch (err: any) {
      console.error('[Hashtag] trending error:', err)
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
    }
  })

  app.get('/hashtags/search', async (request, reply) => {
    try {
      const { q, limit } = request.query as { q?: string; limit?: string }
      const data = await searchHashtags(q ?? '', limit ? parseInt(limit, 10) || 10 : 10)
      return reply.send({ success: true, data })
    } catch (err: any) {
      console.error('[Hashtag] search error:', err)
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
    }
  })

  app.get('/hashtags/:tag', async (request, reply) => {
    try {
      const { tag } = request.params as { tag: string }
      const data = await getHashtagStats(decodeURIComponent(tag))
      return reply.send({ success: true, data })
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
    }
  })

  // GET /reels - Fetch reels
  // - Without vendor_id: returns main feed (all active reels)
  // - With vendor_id: returns reels for that vendor
  // Optional query: include_all=true (vendor only, shows inactive)
  // Auth optional: if provided, includes user's like/save status
  // optionalAuthenticate: without it request.user was never set, so is_liked/is_saved were always false
  app.get('/reels', { preHandler: optionalAuthenticate }, async (request, reply) => {
    return getReelsController(request, reply)
  })

  // POST /reels - Create new reel (authenticated)
  app.post('/reels', { preHandler: authenticate }, async (request, reply) => {
    return createReelController(request, reply)
  })

  // GET /reels/:id - Get single reel (enriched)
  app.get('/reels/:id', { preHandler: optionalAuthenticate }, async (request, reply) => {
    return getReelController(request, reply)
  })

  // POST /reels/:id/view - Increment view count (authenticated)
  app.post('/reels/:id/view', { preHandler: optionalAuthenticate }, async (request, reply) => {
    return incrementViewController(request, reply)
  })

  // POST /reels/:id/like - Toggle like (authenticated)
  app.post('/reels/:id/like', { preHandler: authenticate }, async (request, reply) => {
    return toggleLikeController(request, reply)
  })

  // POST /reels/:id/save - Toggle save (authenticated)
  app.post('/reels/:id/save', { preHandler: authenticate }, async (request, reply) => {
    return toggleSaveController(request, reply)
  })

  // DELETE /reels/:id - Delete reel (authenticated, vendor only)
  // PATCH /reels/:id - Edit caption / tagged product (owner, within 15 min of posting)
  app.patch('/reels/:id', { preHandler: authenticate }, async (request, reply) => {
    return updateReelController(request, reply)
  })

  app.delete('/reels/:id', { preHandler: authenticate }, async (request, reply) => {
    return deleteReelController(request, reply)
  })

  // GET /reels/saved - Get saved reels for current user (authenticated)
  app.get('/reels/saved', { preHandler: authenticate }, async (request, reply) => {
    return getSavedReelsController(request, reply)
  })
}
