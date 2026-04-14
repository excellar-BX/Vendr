import { FastifyInstance } from 'fastify';
import {
  submitVerification,
  reviewVerification,
  getVerificationByVendorId,
  getPendingVerifications,
  getVerificationStatus,
} from './verification.service';
import { authenticate } from '../../middlewares/authenticate';

export async function verificationRoutes(fastify: FastifyInstance) {
  // Submit verification request (vendor)
  fastify.post('/verification/submit', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = (request as any).user.id;
      const input = request.body as any;
      
      try {
        const result = await submitVerification(userId, input);
        return reply.status(201).send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Get verification by vendor ID
  fastify.get('/verification/vendor/:vendorId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { vendorId } = request.params as { vendorId: string };
      
      try {
        const result = await getVerificationByVendorId(vendorId);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Get verification status for a vendor
  fastify.get('/verification/status/:vendorId', {
    handler: async (request, reply) => {
      const { vendorId } = request.params as { vendorId: string };
      
      try {
        const result = await getVerificationStatus(vendorId);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Get all pending verifications (admin)
  fastify.get('/verification/pending', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      try {
        const result = await getPendingVerifications();
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Review verification request (admin)
  fastify.patch('/verification/:id/review', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const reviewerId = (request as any).user.id;
      const { id } = request.params as { id: string };
      const input = request.body as any;
      
      try {
        const result = await reviewVerification(id, reviewerId, input);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });
}
