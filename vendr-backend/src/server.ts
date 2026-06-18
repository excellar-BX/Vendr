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
import { notificationRoutes } from './services/notification/notification.routes'
import { waitlistRoutes } from './services/waitlist/waitlist.controller'
import { verificationRoutes } from './services/verification/verification.routes'
import { escrowRoutes } from './services/escrow/escrow.routes'
import { disputeRoutes } from './services/dispute/dispute.routes'
import { adminRoutes } from './services/admin/admin.routes'
import { vendorReportRoutes } from './services/vendor-report/vendor-report.routes'
import { vendorAnalyticsRoutes } from './services/vendor-analytics/vendor-analytics.routes'
import { initSocket } from './lib/socket'

export async function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
  })

  // Allow empty JSON bodies for POST/PUT/PATCH requests
  // This handles cases where clients send Content-Type: application/json with no body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {})
      return
    }
    try {
      done(null, JSON.parse(typeof body === 'string' ? body : body.toString()))
    } catch (err) {
      done(err as Error | null)
    }
  })

// ─── Plugins ──────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true)

      const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,        // any localhost port
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,     // any 127.0.0.1 port
        /^https?:\/\/.*\.ngrok-free\.app$/,   // ngrok free tunnels
        /^https?:\/\/.*\.ngrok\.io$/,         // ngrok legacy
        /^https?:\/\/.*\.ngrok-free\.dev$/,   // ngrok free dev tunnels
        /^https?:\/\/.*\.vercel\.app$/,       // Vercel deployments
        /^https?:\/\/.*\.onrender\.com$/,     // Render deployments
      ]

      // Add production origins via env: ALLOWED_ORIGINS=https://admin.vendr.ng,https://app.vendr.ng
      // Explicitly allow the current ngrok domain and web development origins
      const explicitOrigins = [
        'https://vendr-production.up.railway.app',
        'http://localhost:8081',
        'http://localhost:19006',
        ...(process.env.ALLOWED_ORIGINS ?? '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      ]

      const isAllowed =
        allowedPatterns.some((pattern) => pattern.test(origin)) ||
        explicitOrigins.includes(origin)

      if (isAllowed) {
        callback(null, true)
      } else {
        console.warn(`CORS blocked origin: ${origin}`)
        callback(new Error(`Origin ${origin} not allowed by CORS`), false)
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
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
  await app.register(notificationRoutes, { prefix: '/api' })
  await app.register(waitlistRoutes, { prefix: '/api' })
  await app.register(verificationRoutes, { prefix: '/api' })
  await app.register(escrowRoutes, { prefix: '/api' })
  await app.register(disputeRoutes, { prefix: '/api' })
  await app.register(adminRoutes, { prefix: '/api' })
  await app.register(vendorReportRoutes, { prefix: '/api' })
  await app.register(vendorAnalyticsRoutes, { prefix: '/api' })

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Initialize Socket.io after server is ready
  app.ready((err) => {
    if (err) throw err
    initSocket(app.server)
  })

  return app
}
