import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, message: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id: string; email: string }
    request.user = { id: decoded.id, email: decoded.email }
  } catch (err) {
    return reply.status(401).send({ success: false, message: 'Invalid or expired access token' })
  }
}

/**
 * Like `authenticate`, but never rejects: attaches `request.user` when a valid
 * Bearer token is present and silently continues as a guest otherwise.
 * Use for public endpoints that personalise results for signed-in users.
 */
export async function optionalAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], env.JWT_ACCESS_SECRET) as { id: string; email: string }
    request.user = { id: decoded.id, email: decoded.email }
  } catch {
    // Invalid/expired token on a public route — treat as guest
  }
}
