import { Resend } from 'resend'
import { env } from '../config/env'

const resend = new Resend(env.RESEND_API_KEY)

const FROM = 'Vendr <noreply@vendr-excellar.vercel.app>'
const BASE_URL = 'https://vendr-excellar.vercel.app'

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${BASE_URL}/verify-email.html?token=${token}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your Vendr email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#E8521A;margin-bottom:8px;">Welcome to Vendr</h2>
        <p style="color:#333;margin-bottom:24px;">Tap the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;background:#E8521A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Verify Email</a>
        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't create a Vendr account, you can safely ignore this email.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${BASE_URL}/reset-password.html?token=${token}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Vendr password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#E8521A;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#333;margin-bottom:24px;">Tap the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#E8521A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Reset Password</a>
        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  })
}