import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  saveVendorController,
  unsaveVendorController,
  checkSavedController,
  getSavedVendorsController,
} from './saved-vendor.controller'

export async function savedVendorRoutes(app: FastifyInstance) {
  // Protected: Save vendor
  app.post('/saved-vendors', { preHandler: authenticate }, async (request, reply) => {
    return saveVendorController(request, reply)
  })

  // Protected: Unsave vendor (delete by vendorId)
  app.delete('/saved-vendors/:vendorId', { preHandler: authenticate }, async (request, reply) => {
    return unsaveVendorController(request, reply)
  })

  // Protected: Check if vendor is saved
  app.get('/saved-vendors/:vendorId/check', { preHandler: authenticate }, async (request, reply) => {
    return checkSavedController(request, reply)
  })

  // Protected: Get all saved vendors for current user
  app.get('/saved-vendors', { preHandler: authenticate }, async (request, reply) => {
    return getSavedVendorsController(request, reply)
  })
}
