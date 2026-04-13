import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  GOOGLE_CLIENT_ID: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().default('onboarding@resend.dev'),

  // Brevo SMTP
  SMTP_KEY: z.string().min(1),
  BREVO_EMAIL: z.string().min(1),
  BREVO_FROM_NAME: z.string().default('Vendr'),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY: z.string().min(1),
  R2_SECRET_KEY: z.string().min(1),
  R2_BUCKET: z.string().default('vendr-media'),
  R2_PUBLIC_URL: z.string().min(1),

  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data