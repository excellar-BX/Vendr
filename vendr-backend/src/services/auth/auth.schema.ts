import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').trim(),
  full_name: z.string().min(1, 'Full name is required'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').trim(),
})

export const googleAuthSchema = z.object({
  id_token: z.string().min(1, 'Google ID token is required'),
})

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters').trim(),
})

export const addPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').trim(),
  confirm_password: z.string().min(1, 'Please confirm your password').trim(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required').trim(),
  new_password: z.string().min(8, 'Password must be at least 8 characters').trim(),
  confirm_password: z.string().min(1, 'Please confirm your password').trim(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type AddPasswordInput = z.infer<typeof addPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>