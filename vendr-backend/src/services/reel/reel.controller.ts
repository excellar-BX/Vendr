import { FastifyRequest, FastifyReply } from 'fastify'
import * as ReelService from './reel.service'
import {
  createReelSchema,
  reelEnrichedSchema,
  toggleResponseSchema
} from './reel.schema'

// ─────────────────────────────────────────────────────────────────────────────
// Get Reels (Feed or Vendor-specific)
// ─────────────────────────────────────────────────────────────────────────────

export async function getReelsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as Record<string, any>

    // Extract optional vendor_id, include_all, limit, offset
    const { vendor_id, include_all, limit, offset } = query
    const userId = request.user?.id // Auth optional; if present, we'll include personalization

    const limitNum = limit ? parseInt(String(limit), 10) : 20
    const offsetNum = offset ? parseInt(String(offset), 10) : 0

    let reels
    if (vendor_id) {
      // Vendor-specific reels
      reels = await ReelService.getReelsByVendor(vendor_id, {
        includeAll: include_all === 'true',
        userId,
        limit: limitNum,
        offset: offsetNum,
      })
    } else {
      // Main feed (all active reels)
      reels = await ReelService.getReelFeed({
        userId,
        limit: limitNum,
        offset: offsetNum,
      })
    }

    // Validate output against enriched schema
    const parsed = reelEnrichedSchema.array().parse(reels)
    return reply.status(200).send({ success: true, data: parsed })
  } catch (err: any) {
    console.error('[Reel] getReels error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Reel
// ─────────────────────────────────────────────────────────────────────────────

export async function createReelController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createReelSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const userId = request.user.id
    const reel = await ReelService.createReel(userId, parsed.data)
    return reply.status(201).send({ success: true, data: reel })
  } catch (err: any) {
    console.error('[Reel] createReel error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Single Reel
// ─────────────────────────────────────────────────────────────────────────────

export async function getReelController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user?.id // Optional
    const reel = await ReelService.getReelById(id, userId)

    const parsed = reelEnrichedSchema.parse(reel)
    return reply.status(200).send({ success: true, data: parsed })
  } catch (err: any) {
    console.error('[Reel] getReel error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Increment View
// ─────────────────────────────────────────────────────────────────────────────

export async function incrementViewController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    await ReelService.incrementReelViewCount(id)
    return reply.status(200).send({ success: true, message: 'View counted' })
  } catch (err: any) {
    console.error('[Reel] incrementView error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Reel
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteReelController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    await ReelService.deleteReel(id, userId)
    return reply.status(200).send({ success: true, message: 'Reel deleted' })
  } catch (err: any) {
    console.error('[Reel] deleteReel error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Like
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleLikeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const result = await ReelService.toggleLike(id, userId)
    const parsed = toggleResponseSchema.parse(result)
    return reply.status(200).send({ success: true, data: parsed })
  } catch (err: any) {
    console.error('[Reel] toggleLike error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Save
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleSaveController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    const result = await ReelService.toggleSave(id, userId)
    const parsed = toggleResponseSchema.parse(result)
    return reply.status(200).send({ success: true, data: parsed })
  } catch (err: any) {
    console.error('[Reel] toggleSave error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Saved Reels
// ─────────────────────────────────────────────────────────────────────────────

export async function getSavedReelsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const reels = await ReelService.getSavedReels(userId)

    const parsed = reelEnrichedSchema.array().parse(reels)
    return reply.status(200).send({ success: true, data: parsed })
  } catch (err: any) {
    console.error('[Reel] getSavedReels error:', err)
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
