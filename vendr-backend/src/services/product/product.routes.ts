import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import {
  getProductsController,
  createProductController,
  getProductController,
  updateProductController,
  deleteProductController,
} from './product.controller'

export async function productRoutes(app: FastifyInstance) {
  // Public: Get products by vendor_id (only available products)
  // Authenticated: vendor can see all their products with include_all=true
  app.get('/products', async (request, reply) => {
    return getProductsController(request, reply)
  })

  // Protected: Create product
  app.post('/products', { preHandler: authenticate }, async (request, reply) => {
    return createProductController(request, reply)
  })

  // Protected: Get single product (ownership check)
  app.get('/products/:id', { preHandler: authenticate }, async (request, reply) => {
    return getProductController(request, reply)
  })

  // Protected: Update product
  app.patch('/products/:id', { preHandler: authenticate }, async (request, reply) => {
    return updateProductController(request, reply)
  })

  // Protected: Delete product
  app.delete('/products/:id', { preHandler: authenticate }, async (request, reply) => {
    return deleteProductController(request, reply)
  })
}
