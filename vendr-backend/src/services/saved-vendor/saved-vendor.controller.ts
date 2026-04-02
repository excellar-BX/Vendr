import { FastifyRequest, FastifyReply } from 'fastify'
import * as SavedVendorService from './saved-vendor.service'
import { savedVendorSchema } from './saved-vendor.schema'

export async function saveVendorController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = savedVendorSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }

  try {
    const userId = request.user.id
    const saved = await SavedVendorService.saveVendor(userId, parsed.data)
    return reply.status(201).send({ success: true, data: saved })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function unsaveVendorController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendorId } = request.params as { vendorId: string }
    const userId = request.user.id
    await SavedVendorService.unsaveVendor(userId, vendorId)
    return reply.status(200).send({ success: true, message: 'Vendor unsaved' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function checkSavedController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { vendorId } = request.params as { vendorId: string }
    const userId = request.user.id
    const isSaved = await SavedVendorService.isVendorSaved(userId, vendorId)
    return reply.status(200).send({ success: true, data: { is_saved: isSaved } })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getSavedVendorsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const saved = await SavedVendorService.getSavedVendors(userId)
    return reply.status(200).send({ success: true, data: saved })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
