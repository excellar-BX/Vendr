import { FastifyRequest, FastifyReply } from 'fastify'
import * as UserService from './user.service'
import { updatePreferencesSchema } from './user.schema'

export async function getMyProfileController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    const data = await UserService.getMyProfile(userId)
    return reply.status(200).send({ success: true, data })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function updatePreferencesController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updatePreferencesSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const userId = request.user.id
    const data = await UserService.updatePreferences(userId, parsed.data)
    return reply.status(200).send({ success: true, data })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function deleteMyAccountController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id
    await UserService.deleteMyAccount(userId)
    return reply.status(200).send({ success: true, message: 'Account deleted successfully' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}
