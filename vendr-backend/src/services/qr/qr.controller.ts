import { FastifyRequest, FastifyReply } from 'fastify';
import * as QrService from './qr.service';

export async function generateQrCodesController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const result = await QrService.generateOrderQrCodes(id);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getOrderQrCodesController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const { role } = request.query as { role: 'seller' | 'buyer' };
    const userId = (request as any).user.id;
    const result = await QrService.getOrderQrCodes(id, userId, role);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}
