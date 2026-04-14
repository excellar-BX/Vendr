import { FastifyInstance } from 'fastify';
import {
  createEscrowHold,
  releaseEscrow,
  refundEscrow,
  getEscrowStatus,
  confirmDelivery,
  autoReleaseEscrow,
} from './escrow.service';
import { authenticate } from '../../middlewares/authenticate';

export async function escrowRoutes(fastify: FastifyInstance) {
  // Create escrow hold (internal, called by payment webhook)
  fastify.post('/escrow/hold', {
    handler: async (request, reply) => {
      const input = request.body as any;
      
      try {
        const result = await createEscrowHold(input);
        return reply.status(201).send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Confirm delivery (buyer)
  fastify.post('/escrow/confirm-delivery/:orderId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const buyerId = (request as any).user.id;
      const { orderId } = request.params as { orderId: string };
      
      try {
        const result = await confirmDelivery(orderId, buyerId);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Release escrow (admin)
  fastify.post('/escrow/release/:orderId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      
      try {
        const result = await releaseEscrow(orderId);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Refund escrow (admin)
  fastify.post('/escrow/refund/:orderId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { reason } = request.body as { reason?: string };
      
      try {
        const result = await refundEscrow(orderId, reason);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Get escrow status
  fastify.get('/escrow/status/:orderId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      
      try {
        const result = await getEscrowStatus(orderId);
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });

  // Auto-release escrow (cron job endpoint)
  fastify.post('/escrow/auto-release', {
    handler: async (request, reply) => {
      try {
        const result = await autoReleaseEscrow();
        return reply.send(result);
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ message: error.message });
      }
    },
  });
}
