import { FastifyInstance } from 'fastify';
import {
  getDashboardStats,
  getVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest,
  getUsers,
  softDeleteUser,
  getVendors,
  toggleVendorFraudFlag,
  suspendVendor,
  getOrders,
  manualReleaseEscrow,
  cancelOrder,
  getWaitlist,
  getTransactions,
  getWalletTransactions,
} from './admin.service';
import { authenticate } from '../../middlewares/authenticate';

export async function adminRoutes(fastify: FastifyInstance) {
  // Dashboard Stats
  fastify.get('/admin/stats', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      try {
        const stats = await getDashboardStats();
        return reply.send(stats);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Verification Requests
  fastify.get('/admin/verification-requests', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      try {
        const requests = await getVerificationRequests();
        return reply.send(requests);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/verification-requests/:id/approve', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await approveVerificationRequest(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/verification-requests/:id/reject', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      try {
        const result = await rejectVerificationRequest(id, reason);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Users
  fastify.get('/admin/users', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', search } = request.query as {
        limit?: string;
        offset?: string;
        search?: string;
      };
      try {
        const result = await getUsers(
          parseInt(limit),
          parseInt(offset),
          search
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.delete('/admin/users/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await softDeleteUser(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Vendors
  fastify.get('/admin/vendors', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', search } = request.query as {
        limit?: string;
        offset?: string;
        search?: string;
      };
      try {
        const result = await getVendors(
          parseInt(limit),
          parseInt(offset),
          search
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.patch('/admin/vendors/:id/fraud-flag', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { is_fraud_flagged, fraud_reason } = request.body as {
        is_fraud_flagged: boolean;
        fraud_reason?: string;
      };
      try {
        const result = await toggleVendorFraudFlag(id, is_fraud_flagged, fraud_reason);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.patch('/admin/vendors/:id/suspend', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await suspendVendor(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Orders & Escrow
  fastify.get('/admin/orders', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', escrowStatus } = request.query as {
        limit?: string;
        offset?: string;
        escrowStatus?: string;
      };
      try {
        const result = await getOrders(
          parseInt(limit),
          parseInt(offset),
          escrowStatus
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.patch('/admin/orders/:id/release', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await manualReleaseEscrow(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.patch('/admin/orders/:id/cancel', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await cancelOrder(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Waitlist
  fastify.get('/admin/waitlist', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      try {
        const entries = await getWaitlist();
        return reply.send(entries);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Transactions
  fastify.get('/admin/transactions', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', status, type } = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
        type?: string;
      };
      try {
        const result = await getTransactions(
          parseInt(limit),
          parseInt(offset),
          status,
          type
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  // Wallet Transactions
  fastify.get('/admin/wallet-transactions', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', txType } = request.query as {
        limit?: string;
        offset?: string;
        txType?: string;
      };
      try {
        const result = await getWalletTransactions(
          parseInt(limit),
          parseInt(offset),
          txType
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });
}
