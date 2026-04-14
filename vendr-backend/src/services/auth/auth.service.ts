import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import prisma from '../../lib/prisma'
import { env } from '../../config/env'
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email'
import type { RegisterInput, LoginInput, GoogleAuthInput } from './auth.schema'

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID)

// ─── Token helpers ────────────────────────────────────────────────────────────

function generateAccessToken(payload: { id: string; email: string }) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

function generateRefreshToken(payload: { id: string; email: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

function getRefreshTokenExpiry(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace('d', ''), 10) || 30
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + days)
  return expiry
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw { statusCode: 409, message: 'Email already in use' }
  }

  const hashed = await bcrypt.hash(input.password, 12)

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashed,
      full_name: input.full_name,
    },
    select: { id: true, email: true, full_name: true, avatar_url: true, created_at: true },
  })

  // Create wallet for new user
  await prisma.wallet.create({
    data: {
      user_id: user.id,
      available_balance: 0,
      frozen_balance: 0,
      currency: 'NGN',
    },
  })

  // Create email verification token (24h expiry)
  const verifyToken = generateSecureToken()
  const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.emailVerificationToken.create({
    data: { token: verifyToken, user_id: user.id, expires_at: verifyExpiry },
  })

  await sendVerificationEmail(user.email, verifyToken)

  const accessToken = generateAccessToken({ id: user.id, email: user.email })
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email })

  await prisma.refreshToken.create({
    data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
  })

  return { user, accessToken, refreshToken }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      is_vendor_verified: true,
      is_deleted: true,
      notifications_enabled: true,
      created_at: true,
      password: true,
      vendors: {
        where: { is_active: true },
        select: { id: true, shop_name: true, is_active: true },
      },
    },
  })

  if (!user || !user.password) {
    throw { statusCode: 401, message: 'Invalid email or password' }
  }

  const valid = await bcrypt.compare(input.password, user.password)
  if (!valid) {
    throw { statusCode: 401, message: 'Invalid email or password' }
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email })
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email })

  await prisma.refreshToken.create({
    data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
  })

  const { password: _pw, vendors, ...safeUser } = user as any
  return {
    user: {
      ...safeUser,
      vendor: vendors && vendors.length > 0 ? vendors[0] : null,
    },
    accessToken,
    refreshToken
  }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export async function googleAuth(input: GoogleAuthInput) {
  const ticket = await googleClient.verifyIdToken({
    idToken: input.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload || !payload.email) {
    throw { statusCode: 401, message: 'Invalid Google token' }
  }

  let user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      is_vendor_verified: true,
      is_deleted: true,
      notifications_enabled: true,
      created_at: true,
      google_id: true,
      vendors: {
        where: { is_active: true },
        select: { id: true, shop_name: true, is_active: true },
      },
    },
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: payload.email,
        full_name: payload.name ?? null,
        avatar_url: payload.picture ?? null,
        google_id: payload.sub,
        is_verified: true, // Google accounts are pre-verified
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        phone: true,
        is_verified: true,
        is_vendor_verified: true,
        is_deleted: true,
        notifications_enabled: true,
        created_at: true,
        vendors: {
          where: { is_active: true },
          select: { id: true, shop_name: true, is_active: true },
        },
      },
    })

    // Create wallet for new user
    await prisma.wallet.create({
      data: {
        user_id: user.id,
        available_balance: 0,
        frozen_balance: 0,
        currency: 'NGN',
      },
    })
  } else if (!user.google_id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { google_id: payload.sub, is_verified: true },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        phone: true,
        is_verified: true,
        is_vendor_verified: true,
        is_deleted: true,
        notifications_enabled: true,
        created_at: true,
        vendors: {
          where: { is_active: true },
          select: { id: true, shop_name: true, is_active: true },
        },
      },
    })
  }

  const accessToken = generateAccessToken({ id: user.id, email: user.email })
  const refreshToken = generateRefreshToken({ id: user.id, email: user.email })

  await prisma.refreshToken.create({
    data: { token: refreshToken, user_id: user.id, expires_at: getRefreshTokenExpiry() },
  })

  const { vendors, ...safeUser } = user as any
  return {
    user: {
      ...safeUser,
      vendor: vendors && vendors.length > 0 ? vendors[0] : null,
    },
    accessToken,
    refreshToken
  }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } })

  if (!record) {
    throw { statusCode: 400, message: 'Invalid verification token' }
  }

  if (record.expires_at < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } })
    throw { statusCode: 400, message: 'Verification token has expired' }
  }

  await prisma.user.update({
    where: { id: record.user_id },
    data: { is_verified: true },
  })

  await prisma.emailVerificationToken.delete({ where: { token } })

  return { message: 'Email verified successfully' }
}

// ─── Resend Verification ──────────────────────────────────────────────────────

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to avoid email enumeration
  if (!user || user.is_verified) return

  // Delete any existing tokens for this user
  await prisma.emailVerificationToken.deleteMany({ where: { user_id: user.id } })

  const token = generateSecureToken()
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.emailVerificationToken.create({
    data: { token, user_id: user.id, expires_at: expiry },
  })

  await sendVerificationEmail(email, token)
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to avoid email enumeration
  if (!user || !user.password) return

  // Delete any existing reset tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } })

  const token = generateSecureToken()
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { token, user_id: user.id, expires_at: expiry },
  })

  await sendPasswordResetEmail(email, token)
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record || record.used) {
    throw { statusCode: 400, message: 'Invalid or already used reset token' }
  }

  if (record.expires_at < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } })
    throw { statusCode: 400, message: 'Reset token has expired' }
  }

  const hashed = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: record.user_id },
    data: { password: hashed },
  })

  // Mark token as used and invalidate all refresh tokens (force re-login)
  await prisma.passwordResetToken.update({ where: { token }, data: { used: true } })
  await prisma.refreshToken.deleteMany({ where: { user_id: record.user_id } })
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refresh(token: string) {
  let decoded: { id: string; email: string }

  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; email: string }
  } catch {
    throw { statusCode: 401, message: 'Invalid or expired refresh token' }
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  if (!stored || stored.expires_at < new Date()) {
    throw { statusCode: 401, message: 'Refresh token not found or expired' }
  }

  // Don't delete the refresh token immediately - let it expire naturally
  // This prevents race conditions and makes the session more resilient
  // await prisma.refreshToken.deleteMany({ where: { token } })

  const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email })
  // Keep the same refresh token to avoid race conditions
  // Only issue new refresh token if the current one is close to expiring (within 7 days)
  const daysUntilExpiry = Math.floor((stored.expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  let newRefreshToken = token
  if (daysUntilExpiry <= 7) {
    // Issue new refresh token if current one expires within 7 days
    newRefreshToken = generateRefreshToken({ id: decoded.id, email: decoded.email })
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, user_id: decoded.id, expires_at: getRefreshTokenExpiry() },
    })
  }

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } })
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      phone: true,
      is_verified: true,
      is_vendor_verified: true,
      is_deleted: true,
      notifications_enabled: true,
      created_at: true,
      vendors: {
        where: { is_active: true },
        select: { id: true, shop_name: true, is_active: true },
      },
    },
  })

  if (!user) {
    throw { statusCode: 404, message: 'User not found' }
  }

  const { vendors, ...userData } = user as any
  return {
    ...userData,
    vendor: vendors && vendors.length > 0 ? vendors[0] : null,
  }
}