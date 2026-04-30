import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  registerController,
  loginController,
  googleAuthController,
  refreshController,
  logoutController,
  getMeController,
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
  addPasswordController,
  changePasswordController,
} from './auth.controller'

export async function authRoutes(app: FastifyInstance) {
  // Public
  app.post('/auth/register', registerController)
  app.post('/auth/login', loginController)
  app.post('/auth/google', googleAuthController)
  app.post('/auth/refresh', refreshController)
  app.post('/auth/logout', logoutController)

  // Email verification
  app.post('/auth/verify-email', verifyEmailController)
  app.post('/auth/resend-verification', resendVerificationController)

  // Password reset
  app.post('/auth/forgot-password', forgotPasswordController)
  app.post('/auth/reset-password', resetPasswordController)

  // Protected
  app.get('/auth/me', { preHandler: authenticate }, getMeController)
  app.post('/auth/add-password', { preHandler: authenticate }, addPasswordController)
  app.post('/auth/change-password', { preHandler: authenticate }, changePasswordController)
}