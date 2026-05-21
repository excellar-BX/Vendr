import prisma from '../lib/prisma'

export async function deleteExpiredAccounts() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

  const expiredUsers = await prisma.user.findMany({
    where: {
      is_deleted: true,
      deleted_at: { lte: cutoff },
    },
    select: { id: true },
  })

  if (expiredUsers.length === 0) return

  const ids = expiredUsers.map((u) => u.id)

  // Delete in dependency order to avoid FK violations
  await prisma.savedVendor.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.notification.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.review.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.emailVerificationToken.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.passwordResetToken.deleteMany({ where: { user_id: { in: ids } } })
  await prisma.wallet.deleteMany({ where: { user_id: { in: ids } } })
  // Add any other related tables (orders, vendor profiles, etc.) before deleting the user
  await prisma.user.deleteMany({ where: { id: { in: ids } } })

  console.log(`[cleanup] Permanently deleted ${ids.length} expired account(s)`)
}