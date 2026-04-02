import { FastifyRequest, FastifyReply } from 'fastify'
import * as ReelService from './reel.service'
import { createReelSchema } from './reel.schema'

export async function getReelsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendor_id } = request.query as { vendor_id?: string }
    const { include_all } = request.query as { include_all?: string }

    if (!vendor_id) {
      return reply.status(400).send({ success: false, message: 'vendor_id is required' })
    }

    const reels = await ReelService.getReelsByVendor(vendor_id, include_all === 'true')
    return reply.status(200).send({ success: true, data: reels })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

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
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getReelController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const reel = await ReelService.getReelById(id)
    return reply.status(200).send({ success: true, data: reel })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function deleteReelController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    const userId = request.user.id
    await ReelService.deleteReel(id, userId)
    return reply.status(200).send({ success: true, message: 'Reel deleted' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function incrementViewController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string }
    await ReelService.incrementReelViewCount(id)
    return reply.status(200).send({ success: true, message: 'View counted' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getSavedReelsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const reels = await ReelService.getSavedReels(userId)
    return reply.status(200).send({ success: true, data: reels })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
