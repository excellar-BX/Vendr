import 'dotenv/config' // Load .env first — must be before anything else
import './config/env' // Validate env vars
import { buildServer } from './server'
import { env } from './config/env'
import { pollPendingWithdrawals } from './services/wallet/wallet.controller'
import { deleteExpiredAccounts } from './jobs/deleteExpiredAccounts'

async function main() {
  const app = await buildServer()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`Vendr backend running on port ${env.PORT}`)

    // Poll pending withdrawals every 10 minutes (safety net for missed webhooks)
    setInterval(async () => {
      try {
        await pollPendingWithdrawals();
      } catch (err) {
        console.error('[Cron] Poll failed:', err);
      }
    }, 10 * 60 * 1000);

    // Delete expired accounts (30-day soft delete window)
    deleteExpiredAccounts()
    setInterval(deleteExpiredAccounts, 24 * 60 * 60 * 1000)
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

main()