import { FastifyRequest, FastifyReply } from 'fastify';
import * as RunnerService from './runner.service';
import {
  registerRunnerSchema,
  updateRunnerStatusSchema,
  listJobsSchema,
  updateRunStatusSchema,
  listEarningsSchema,
  withdrawEarningsSchema,
} from './runner.schema';

export async function registerRunnerController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = registerRunnerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.registerRunner(userId, parsed.data as RunnerService.RegisterRunnerInput);
    return reply.status(201).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getRunnerProfileController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.getRunnerByUserId(userId);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function updateRunnerStatusController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateRunnerStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.updateRunnerStatus(userId, parsed.data.is_online);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function listJobsController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listJobsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.listAvailableJobs(
      userId,
      parsed.data.filter,
      parsed.data.lat,
      parsed.data.lng,
      parsed.data.limit,
      parsed.data.offset,
    );
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getJobDetailController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const job = await RunnerService.getJobDetail((request as any).user.id, id);
    return reply.status(200).send({ success: true, data: job });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function acceptJobController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    // The job id is in the URL (/runner/jobs/:id/accept); requiring it in the body rejected every accept
    const { id } = request.params as { id: string };
    const result = await RunnerService.acceptJob(userId, id);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function declineJobController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.id;
    const result = await RunnerService.declineJob(userId, id);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function listActiveRunsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    const { scope } = (request.query ?? {}) as { scope?: string };
    const result = await RunnerService.listActiveRuns(userId, scope === 'completed' ? 'completed' : 'active');
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getRunDetailController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.id;
    const result = await RunnerService.getRunDetail(userId, id);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function updateRunStatusController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateRunStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.id;
    const result = await RunnerService.updateRunStatus(userId, id, parsed.data.status);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function listEarningsController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listEarningsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.listEarnings(
      userId,
      parsed.data.filter,
      parsed.data.limit,
      parsed.data.offset,
    );
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getRunnerBalanceController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.getRunnerBalance(userId);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function withdrawEarningsController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawEarningsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.withdrawEarnings(userId, parsed.data.amount);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function getDashboardStatsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id;
    const result = await RunnerService.getDashboardStats(userId);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function scanPickupQrController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    // "code" = typed 6-digit pickup code; "qr_token" kept for QR scanners
    const { qr_token, code } = (request.body ?? {}) as { qr_token?: string; code?: string };
    const userId = (request as any).user.id;
    const result = await RunnerService.scanPickupQr(userId, id, code ?? qr_token ?? '');
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}

export async function scanDeliveryQrController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    // "code" = the buyer's delivery code; "qr_token" kept for QR scanners
    const { qr_token, code } = (request.body ?? {}) as { qr_token?: string; code?: string };
    const userId = (request as any).user.id;
    const result = await RunnerService.scanDeliveryQr(userId, id, code ?? qr_token ?? '');
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({ success: false, message: err.message });
  }
}
