import 'dotenv/config' // Load .env first — must be before anything else
import './config/env' // Validate env vars
import { buildServer } from './server'
import { env } from './config/env'

async function main() {
  const app = await buildServer()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`Vendr backend running on port ${env.PORT}`)
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

main()