import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../lib/prisma'

/**
 * Use after `authenticate`. Admin routes used to accept ANY logged-in user,
 * so a normal account could suspend vendors, release escrow or broadcast
 * notifications. This checks the account's role on every request.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.id) {
    return reply.status(401).send({ success: false, message: 'Not signed in' })
  }
  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: { role: true, is_deleted: true },
  })
  if (!user || user.is_deleted || user.role !== 'admin') {
    return reply.status(403).send({ success: false, message: 'Admin privileges required' })
  }
}
