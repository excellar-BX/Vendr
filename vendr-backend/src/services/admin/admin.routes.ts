import { FastifyInstance } from 'fastify';
import {
  adminLogin,
  adminMe,
  getDashboardStats,
  getVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest,
  getUsers,
  getUser,
  updateUser,
  softDeleteUser,
  getVendors,
  getVendor,
  flagVendor,
  unflagVendor,
  toggleVendorFraudFlag,
  suspendVendor,
  unsuspendVendor,
  getOrders,
  manualReleaseEscrow,
  cancelOrder,
  getWaitlist,
  getTransactions,
  getWalletTransactions,
  getDisputes,
  resolveDispute,
  broadcastNotification,
} from './admin.service';
import * as VendorReportService from '../vendor-report/vendor-report.service';
import { updateVendorReportSchema } from '../vendor-report/vendor-report.schema';
import { authenticate } from '../../middlewares/authenticate';

export async function adminRoutes(fastify: FastifyInstance) {
  // Admin Login (public)
  fastify.post('/admin/login', {
    handler: async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };
      try {
        const result = await adminLogin(email, password);
        return reply.send(result);
      } catch (error: any) {
        reply.status(401).send({ message: error.message });
      }
    },
  });

  // Get current admin user (protected)
  fastify.get('/admin/me', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      try {
        const result = await adminMe(request.user.id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(401).send({ message: error.message });
      }
    },
  });

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
  fastify.get('/admin/verifications', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { status, limit = '50', offset = '0' } = request.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      try {
        let requests = await getVerificationRequests();
        // Filter by status if specified
        if (status) {
          requests = requests.filter((r: any) => r.status === status);
        }
        // Apply pagination
        const offsetNum = parseInt(offset);
        const limitNum = parseInt(limit);
        const paginated = requests.slice(offsetNum, offsetNum + limitNum);
        return reply.send({ items: paginated, total: requests.length });
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.get('/admin/verifications/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const requests = await getVerificationRequests();
        const request = requests.find((r: any) => r.id === id);
        if (!request) {
          return reply.status(404).send({ message: 'Verification request not found' });
        }
        return reply.send({ verification: request });
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/verifications/:id/approve', {
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

  fastify.post('/admin/verifications/:id/reject', {
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
      const { limit = '50', offset = '0', search, role } = request.query as {
        limit?: string;
        offset?: string;
        search?: string;
        role?: string;
      };
      try {
        const result = await getUsers(
          parseInt(limit),
          parseInt(offset),
          search,
          role
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

  fastify.get('/admin/users/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await getUser(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(404).send({ message: error.message });
      }
    },
  });

  fastify.patch('/admin/users/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await updateUser(id, request.body);
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
      const { limit = '50', offset = '0', search, is_fraud_flagged } = request.query as {
        limit?: string;
        offset?: string;
        search?: string;
        is_fraud_flagged?: string;
      };
      try {
        const result = await getVendors(
          parseInt(limit),
          parseInt(offset),
          search
        );
        // Filter by fraud flag if specified
        if (is_fraud_flagged !== undefined) {
          const isFlagged = is_fraud_flagged === 'true';
          result.vendors = result.vendors.filter((v: any) => v.is_fraud_flagged === isFlagged);
        }
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.get('/admin/vendors/:id', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await getVendor(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(404).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/vendors/:id/flag', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      try {
        const result = await flagVendor(id, reason);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/vendors/:id/unflag', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await unflagVendor(id);
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/vendors/:id/suspend', {
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

  fastify.post('/admin/vendors/:id/unsuspend', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await unsuspendVendor(id);
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
      const { limit = '50', offset = '0', status } = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
      };
      try {
        const result = await getOrders(
          parseInt(limit),
          parseInt(offset),
          status
        );
        return reply.send({ items: result.orders, total: result.total });
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

  // Disputes
  fastify.get('/admin/disputes', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { status, limit = '50', offset = '0' } = request.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      try {
        const result = await getDisputes(
          parseInt(limit),
          parseInt(offset),
          status
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ message: error.message });
      }
    },
  });

  fastify.post('/admin/disputes/:id/resolve', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { resolution, admin_notes } = request.body as {
        resolution: 'refund_buyer' | 'release_vendor';
        admin_notes?: string;
      };
      if (!resolution || !['refund_buyer', 'release_vendor'].includes(resolution)) {
        return reply.status(400).send({ message: 'resolution must be refund_buyer or release_vendor' });
      }
      try {
        const result = await resolveDispute(id, resolution, admin_notes);
        return reply.send(result);
      } catch (error: any) {
        // If error has a statusCode (e.g., from service layer), use it; otherwise default to 500
        const status = error.statusCode || 500;
        reply.status(status).send({ message: error.message });
      }
    },
  });

  // Broadcast notification
  fastify.post('/admin/notifications/broadcast', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { title, body, audience } = request.body as {
        title: string;
        body: string;
        audience: 'all' | 'buyers' | 'vendors';
      };
      try {
        const result = await broadcastNotification(title, body, audience);
        return reply.send(result);
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

  // Vendor Reports
  fastify.get('/admin/vendor-reports', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { limit = '50', offset = '0', status } = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
      };
      try {
        const result = await VendorReportService.getVendorReports(
          parseInt(limit),
          parseInt(offset),
          status
        );
        return reply.send(result);
      } catch (error: any) {
        reply.status(500).send({ success: false, message: error.message });
      }
    },
  });

  fastify.get('/admin/vendor-reports/:reportId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { reportId } = request.params as { reportId: string };
      try {
        const result = await VendorReportService.getVendorReport(reportId);
        return reply.send({ success: true, data: result });
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ success: false, message: error.message });
      }
    },
  });

  fastify.patch('/admin/vendor-reports/:reportId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { reportId } = request.params as { reportId: string };
      const parseResult = updateVendorReportSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ success: false, message: 'Invalid input', errors: parseResult.error.errors });
      }
      const { status, admin_notes } = parseResult.data;
      try {
        const result = await VendorReportService.updateVendorReport(
          reportId,
          { status, admin_notes },
          request.user.id
        );
        return reply.send({ success: true, data: result });
      } catch (error: any) {
        reply.status(error.statusCode || 500).send({ success: false, message: error.message });
      }
    },
  });
}
