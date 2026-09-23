import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import * as QrController from './qr.controller';

export async function qrRoutes(app: FastifyInstance) {
  // Generate QR codes for an order (admin/seller only)
  app.post('/orders/:id/qr', { preHandler: [authenticate] }, QrController.generateQrCodesController);

  // Get QR code for display (seller or buyer)
  app.get('/orders/:id/qr', { preHandler: [authenticate] }, QrController.getOrderQrCodesController);
}
