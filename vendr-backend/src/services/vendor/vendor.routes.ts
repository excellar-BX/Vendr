import { FastifyInstance } from 'fastify';
import prisma from '../../lib/prisma';
import { authenticate } from '../../middlewares/authenticate';
import { createVendor, getVendorByUserId, getVendorById, updateVendor, deleteVendorStore } from './vendor.service';
import { z } from 'zod';

const createVendorSchema = z.object({
  business_name: z.string().min(1).max(100),
  category: z.string().min(1),
  description: z.string().min(1).max(200),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().min(1),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  open_days: z.array(z.string()).min(1),
  open_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  close_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  logo_url: z.string().url().optional().nullable(),
  banner_url: z.string().url().optional().nullable(),
});

const updateVendorSchema = createVendorSchema.partial().extend({
  is_active: z.boolean().optional(),
  is_verified: z.boolean().optional(),
});

export async function vendorRoutes(app: FastifyInstance) {
  // Public: Get vendor by ID (for vendor profile page)
  app.get('/vendors/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const vendor = await getVendorById(id);
      return reply.status(200).send({ success: true, data: vendor });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });

  // List vendors (public, could add filters like category, location later)
  app.get('/vendors', async (request, reply) => {
    try {
      const { category, is_verified, is_active, ids, has_location } = request.query as {
        category?: string;
        is_verified?: string;
        is_active?: string;
        ids?: string;
        has_location?: string;
      };

      const where: any = { is_active: true };
      if (category) where.category = category;
      if (is_verified !== undefined) where.is_verified = is_verified === 'true';
      if (ids) {
        const idArray = ids.split(',').filter(Boolean);
        if (idArray.length > 0) where.id = { in: idArray };
      }
      if (has_location === 'true') {
        where.lat = { not: null };
        where.lng = { not: null };
      }

      const vendors = await prisma.vendor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
            }
          }
        },
        orderBy: { rating: 'desc' },
      })

      return reply.status(200).send({ success: true, data: vendors });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });

  // Create vendor store (become a vendor)
  app.post('/vendors', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createVendorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    try {
      const userId = request.user.id;
      const vendor = await createVendor(userId, parsed.data);
      return reply.status(201).send({ success: true, data: vendor });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });

  // Get current user's vendor profile
  app.get('/vendors/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const vendor = await getVendorByUserId(userId);
      return reply.status(200).send({ success: true, data: vendor });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });

  // Update vendor profile
  app.patch('/vendors/me', { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateVendorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    try {
      const userId = request.user.id;
      const vendor = await updateVendor(userId, parsed.data);
      return reply.status(200).send({ success: true, data: vendor });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });

  // Delete vendor store (deactivate)
  app.delete('/vendors/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = request.user.id;
      await deleteVendorStore(userId);
      return reply.status(200).send({ success: true, message: 'Vendor store deactivated' });
    } catch (err: any) {
      return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
    }
  });
}
