import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './services/auth/auth.routes'
import { userRoutes } from './services/user/user.routes'

export async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
  })

  // ─── Plugins ──────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(userRoutes, { prefix: '/api' })

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
