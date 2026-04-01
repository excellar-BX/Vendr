import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import { signUploadUrl } from './storage.service';
import { z } from 'zod';

const signSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});

export async function storageRoutes(app: FastifyInstance) {
  app.post('/storage/sign', { preHandler: authenticate }, async (request, reply) => {
    const parsed = signSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    try {
      const { uploadUrl, publicUrl } = await signUploadUrl(parsed.data);
      return reply.status(200).send({ success: true, data: { uploadUrl, publicUrl } });
    } catch (error: any) {
      console.error('[Storage] Sign error:', error);
      return reply.status(500).send({ success: false, message: 'Failed to generate upload URL' });
    }
  });
}
