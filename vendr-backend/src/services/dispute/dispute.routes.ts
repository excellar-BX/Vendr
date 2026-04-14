import { FastifyInstance } from 'fastify';
import { createDispute, resolveDispute, getAllDisputes, getUserDisputes } from './dispute.service';
import { authenticate } from '../../middlewares/authenticate';

export async function disputeRoutes(fastify: FastifyInstance) {
  // Create a dispute (buyer only)
  fastify.post('/disputes', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = request.user.id;
      const { order_id, reason, description } = request.body as {
        order_id: string;
        reason: string;
        description?: string;
      };

      try {
        const result = await createDispute(order_id, userId, reason, description);
        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          message: err.message || 'Failed to create dispute',
        });
      }
    },
  });

  // Resolve a dispute (admin only)
  fastify.patch('/disputes/:disputeId/resolve', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { disputeId } = request.params as { disputeId: string };
      const { resolution, admin_notes } = request.body as {
        resolution: 'refund_buyer' | 'release_vendor';
        admin_notes?: string;
      };

      try {
        const result = await resolveDispute(disputeId, resolution, admin_notes);
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          message: err.message || 'Failed to resolve dispute',
        });
      }
    },
  });

  // Get all disputes (admin only)
  fastify.get('/disputes', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { status, limit = '50', offset = '0' } = request.query as {
        status?: 'open' | 'resolved';
        limit?: string;
        offset?: string;
      };

      try {
        const disputes = await getAllDisputes(
          status,
          parseInt(limit),
          parseInt(offset)
        );
        return reply.status(200).send({
          success: true,
          data: disputes,
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          message: err.message || 'Failed to fetch disputes',
        });
      }
    },
  });

  // Get disputes for current user
  fastify.get('/disputes/me', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = request.user.id;

      try {
        const disputes = await getUserDisputes(userId);
        return reply.status(200).send({
          success: true,
          data: disputes,
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          success: false,
          message: err.message || 'Failed to fetch disputes',
        });
      }
    },
  });
}
