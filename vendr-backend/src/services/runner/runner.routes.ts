import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import * as RunnerController from './runner.controller';

export async function runnerRoutes(app: FastifyInstance) {
  // Register as runner
  app.post('/runner/register', { preHandler: [authenticate] }, RunnerController.registerRunnerController);

  // Get runner profile
  app.get('/runner/profile', { preHandler: [authenticate] }, RunnerController.getRunnerProfileController);

  // Update runner online/offline status
  app.patch('/runner/status', { preHandler: [authenticate] }, RunnerController.updateRunnerStatusController);

  // List available jobs
  app.get('/runner/jobs', { preHandler: [authenticate] }, RunnerController.listJobsController);

  // Get job details
  app.get('/runner/jobs/:id', { preHandler: [authenticate] }, RunnerController.getJobDetailController);

  // Accept a job
  app.post('/runner/jobs/:id/accept', { preHandler: [authenticate] }, RunnerController.acceptJobController);

  // Decline a job
  app.post('/runner/jobs/:id/decline', { preHandler: [authenticate] }, RunnerController.declineJobController);

  // List active runs
  app.get('/runner/runs', { preHandler: [authenticate] }, RunnerController.listActiveRunsController);

  // Get run details
  app.get('/runner/runs/:id', { preHandler: [authenticate] }, RunnerController.getRunDetailController);

  // Update run status
  app.patch('/runner/runs/:id/status', { preHandler: [authenticate] }, RunnerController.updateRunStatusController);

  // Scan pickup QR (seller → runner)
  app.post('/runner/orders/:id/scan-pickup', { preHandler: [authenticate] }, RunnerController.scanPickupQrController);

  // Scan delivery QR (runner → buyer)
  app.post('/runner/orders/:id/scan-delivery', { preHandler: [authenticate] }, RunnerController.scanDeliveryQrController);

  // List earnings
  app.get('/runner/earnings', { preHandler: [authenticate] }, RunnerController.listEarningsController);

  // Get runner balance
  app.get('/runner/earnings/balance', { preHandler: [authenticate] }, RunnerController.getRunnerBalanceController);

  // Withdraw earnings
  app.post('/runner/earnings/withdraw', { preHandler: [authenticate] }, RunnerController.withdrawEarningsController);

  // Get dashboard stats
  app.get('/runner/dashboard/stats', { preHandler: [authenticate] }, RunnerController.getDashboardStatsController);
}
