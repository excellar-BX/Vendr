import { FastifyRequest, FastifyReply } from 'fastify'
import * as AuthService from './auth.service'
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  refreshSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  addPasswordSchema,
  changePasswordSchema,
} from './auth.schema'

export async function registerController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.register(parsed.data)
    return reply.status(201).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.login(parsed.data)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function googleAuthController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = googleAuthSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.googleAuth(parsed.data)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function refreshController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = refreshSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.refresh(parsed.data.refresh_token)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = refreshSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    await AuthService.logout(parsed.data.refresh_token)
    return reply.status(200).send({ success: true, message: 'Logged out successfully' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function getMeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await AuthService.getMe(request.user.id)
    return reply.status(200).send({ success: true, data: user })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function verifyEmailController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = verifyEmailSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.verifyEmail(parsed.data.token)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function resendVerificationController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = resendVerificationSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    await AuthService.resendVerification(parsed.data.email)
    return reply.status(200).send({ success: true, message: 'If that email exists, a verification link has been sent' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function forgotPasswordController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = forgotPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    await AuthService.forgotPassword(parsed.data.email)
    return reply.status(200).send({ success: true, message: 'If that email exists, a reset link has been sent' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function resetPasswordController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = resetPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    await AuthService.resetPassword(parsed.data.token, parsed.data.new_password)
    return reply.status(200).send({ success: true, message: 'Password reset successfully. Please log in again.' })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function addPasswordController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = addPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.addPassword(request.user.id, parsed.data)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}

export async function changePasswordController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = changePasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors })
  }
  try {
    const result = await AuthService.changePassword(request.user.id, parsed.data)
    return reply.status(200).send({ success: true, data: result })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message })
  }
}