import prisma from '../../lib/prisma'
import type { CreateProductInput, UpdateProductInput, ProductOutput } from './product.schema'

/**
 * Get products by vendor_id
 * Public can only see available products; authenticated vendor can see all
 */
export async function getProductsByVendor(vendorId: string, includeAll: boolean = false): Promise<ProductOutput[]> {
  const where: any = { vendor_id: vendorId }

  if (!includeAll) {
    where.is_available = true
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return products.map(p => ({
    id: p.id,
    vendor_id: p.vendor_id,
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.image_url,
    is_available: p.is_available,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  }))
}

/**
 * Get single product by ID with ownership check
 */
export async function getProductById(productId: string, userId?: string): Promise<ProductOutput> {
  const product = await prisma.product.findUnique({ where: { id: productId } })

  if (!product) {
    throw { statusCode: 404, message: 'Product not found' }
  }

  // If user is provided, check if they own it (for update/delete operations)
  if (userId) {
    const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })
    if (!vendor || vendor.id !== product.vendor_id) {
      throw { statusCode: 403, message: 'Not authorized' }
    }
  }

  return {
    id: product.id,
    vendor_id: product.vendor_id,
    name: product.name,
    description: product.description,
    price: product.price,
    image_url: product.image_url,
    is_available: product.is_available,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  }
}

/**
 * Create a new product for the vendor
 */
export async function createProduct(userId: string, input: CreateProductInput): Promise<ProductOutput> {
  // Get user's vendor
  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })

  if (!vendor) {
    throw { statusCode: 404, message: 'Vendor not found. Become a vendor first.' }
  }

  const product = await prisma.product.create({
    data: {
      vendor_id: vendor.id,
      name: input.name,
      description: input.description,
      price: input.price,
      image_url: input.image_url,
      is_available: input.is_available,
    },
  })

  return {
    id: product.id,
    vendor_id: product.vendor_id,
    name: product.name,
    description: product.description,
    price: product.price,
    image_url: product.image_url,
    is_available: product.is_available,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  }
}

/**
 * Update product (vendor only, ownership enforced)
 */
export async function updateProduct(productId: string, userId: string, input: UpdateProductInput): Promise<ProductOutput> {
  // First check ownership
  const product = await prisma.product.findUnique({ where: { id: productId } })

  if (!product) {
    throw { statusCode: 404, message: 'Product not found' }
  }

  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })
  if (!vendor || vendor.id !== product.vendor_id) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price && { price: input.price }),
      ...(input.image_url !== undefined && { image_url: input.image_url }),
      ...(input.is_available !== undefined && { is_available: input.is_available }),
    },
  })

  return {
    id: updated.id,
    vendor_id: updated.vendor_id,
    name: updated.name,
    description: updated.description,
    price: updated.price,
    image_url: updated.image_url,
    is_available: updated.is_available,
    created_at: updated.created_at.toISOString(),
    updated_at: updated.updated_at.toISOString(),
  }
}

/**
 * Delete product (vendor only, ownership enforced)
 */
export async function deleteProduct(productId: string, userId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } })

  if (!product) {
    throw { statusCode: 404, message: 'Product not found' }
  }

  const vendor = await prisma.vendor.findUnique({ where: { user_id: userId } })
  if (!vendor || vendor.id !== product.vendor_id) {
    throw { statusCode: 403, message: 'Not authorized' }
  }

  await prisma.product.delete({ where: { id: productId } })
}
