import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './services/auth/auth.routes'
import { userRoutes } from './services/user/user.routes'
import { vendorRoutes } from './services/vendor/vendor.routes'
import { productRoutes } from './services/product/product.routes'
import { searchRoutes } from './services/search/search.routes'
import { chatRoutes } from './services/chat/chat.routes'
import { reelRoutes } from './services/reel/reel.routes'
import { reviewRoutes } from './services/review/review.routes'
import { savedVendorRoutes } from './services/saved-vendor/saved-vendor.routes'
import { storageRoutes } from './services/storage/storage.routes'
import { walletRoutes } from './services/wallet/wallet.routes'
import { orderRoutes } from './services/order/order.routes'

export async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
  })

  // Allow empty JSON bodies for POST/PUT/PATCH requests
  // This handles cases where clients send Content-Type: application/json with no body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || body.trim() === '') {
      done(null, {})
      return
    }
    try {
      done(null, JSON.parse(body))
    } catch (err) {
      done(err)
    }
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
  await app.register(vendorRoutes, { prefix: '/api' })
  await app.register(productRoutes, { prefix: '/api' })
  await app.register(searchRoutes, { prefix: '/api' })
  await app.register(chatRoutes, { prefix: '/api' })
  await app.register(orderRoutes, { prefix: '/api' })
  await app.register(reelRoutes, { prefix: '/api' })
  await app.register(reviewRoutes, { prefix: '/api' })
  await app.register(savedVendorRoutes, { prefix: '/api' })
  await app.register(walletRoutes, { prefix: '/api' })
  await app.register(storageRoutes, { prefix: '/api' })

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
