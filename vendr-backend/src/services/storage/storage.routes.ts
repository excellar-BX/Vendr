import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authenticate';
import { signUploadUrl, deleteFiles } from './storage.service';
import { z } from 'zod';

const signSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});

const deleteSchema = z.object({
  keys: z.array(z.string()).min(1),
});

export async function storageRoutes(app: FastifyInstance) {
  // Generate signed upload URL
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

  // Delete files from R2 (server-side, requires authentication)
  app.delete('/storage/files', { preHandler: authenticate }, async (request, reply) => {
    const parsed = deleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    try {
      await deleteFiles(parsed.data.keys);
      return reply.status(200).send({ success: true, message: 'Files deleted' });
    } catch (error: any) {
      console.error('[Storage] Delete error:', error);
      return reply.status(500).send({ success: false, message: 'Failed to delete files' });
    }
  });
}
