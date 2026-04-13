import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { env } from '../config/env'

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export class EmailService {
  private resend: Resend | null = null
  private brevoTransporter: nodemailer.Transporter | null = null
  private fromEmail: string
  private baseUrl: string
  private useBrevo: boolean

  constructor() {
    const resendApiKey = env.RESEND_API_KEY
    const brevoSmtpKey = env.SMTP_KEY
    const brevoEmail = env.BREVO_EMAIL

    // Prefer Brevo if configured, otherwise use Resend
    this.useBrevo = !!(brevoSmtpKey && brevoEmail)

    if (this.useBrevo) {
      this.brevoTransporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: brevoEmail,
          pass: brevoSmtpKey,
        },
      })
      this.fromEmail = env.FROM_EMAIL || brevoEmail
      console.log('[Email] Brevo SMTP client initialized')
    } else if (resendApiKey) {
      this.resend = new Resend(resendApiKey)
      this.fromEmail = env.FROM_EMAIL || 'onboarding@resend.dev'
      console.log('[Email] Resend client initialized')
    } else {
      console.warn('[Email] Warning: No email service configured (RESEND_API_KEY or Brevo SMTP credentials)')
      console.warn('[Email] Email functionality will be disabled until this is configured')
      this.resend = null
      this.brevoTransporter = null
      this.fromEmail = 'noreply@vendr.com'
    }

    this.baseUrl = 'https://vendr-excellar.vercel.app'
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.useBrevo && !this.resend) {
      console.warn('[Email] Email service not configured. Skipping email to:', options.to)
      return
    }

    try {
      if (this.useBrevo && this.brevoTransporter) {
        const info = await this.brevoTransporter.sendMail({
          from: `"${env.BREVO_FROM_NAME}" <${this.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        })
        console.log(`[Email] Brevo sent to ${options.to}: ${info.messageId}`)
      } else if (this.resend) {
        const { data, error } = await this.resend.emails.send({
          from: `Vendr <${this.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        })

        if (error) {
          console.error('[Email] Resend error:', error)
          throw new Error(`Failed to send email: ${error.message}`)
        }

        console.log(`[Email] Resend sent to ${options.to}: ${data?.id}`)
      }
    } catch (error) {
      console.error('[Email] Failed to send:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/verify-email.html?token=${token}`

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#E8521A;margin-bottom:8px;">Welcome to Vendr</h2>
        <p style="color:#333;margin-bottom:24px;">Tap the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${verificationUrl}" style="display:inline-block;background:#E8521A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Verify Email</a>
        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't create a Vendr account, you can safely ignore this email.</p>
      </div>
    `

    await this.sendEmail({
      to: email,
      subject: 'Verify your Vendr email',
      html,
    })
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password.html?token=${token}`

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#E8521A;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#333;margin-bottom:24px;">Tap the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#E8521A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Reset Password</a>
        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `

    await this.sendEmail({
      to: email,
      subject: 'Reset your Vendr password',
      html,
    })
  }

  isConfigured(): boolean {
    return this.useBrevo || this.resend !== null
  }
}

// Create singleton instance
const emailService = new EmailService()

// Backwards-compatible standalone functions
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  await emailService.sendVerificationEmail(email, token)
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  await emailService.sendPasswordResetEmail(email, token)
}

// Export singleton for direct access
export { emailService }