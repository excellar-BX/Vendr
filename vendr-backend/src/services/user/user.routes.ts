import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getMyProfileController,
  updateMyProfileController,
  updatePreferencesController,
  deleteMyAccountController
} from './user.controller'

export async function userRoutes(app: FastifyInstance) {
  // Protected - Profile
  app.get('/users/me', { preHandler: authenticate }, getMyProfileController)
  app.patch('/users/me', { preHandler: authenticate }, updateMyProfileController)
  app.patch('/users/me/preferences', { preHandler: authenticate }, updatePreferencesController)
  app.delete('/users/me', { preHandler: authenticate }, deleteMyAccountController)
}
