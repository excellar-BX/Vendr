import prisma from '../../lib/prisma';
import crypto from 'crypto';
import { escrowHoldReleaseAt } from '../../lib/otp';

/**
 * Runner (delivery) flow
 *
 *   job created when a buyer pays for delivery ─► nearby online runners notified
 *   runner accepts (race-safe) ─► seller + buyer notified
 *   pickup: runner enters the seller's 6-digit PICKUP CODE ─► order in_transit
 *   drop-off: runner enters the buyer's DELIVERY CODE (the same code the buyer already
 *   sees in Orders) ─► order delivered + otp_confirmed ─► escrow releases to the vendor
 *   after the usual hold window (escrow cron) ─► runner's fee becomes withdrawable
 *
 * Money rules: the vendor is paid ONLY by escrow.releaseEscrow (items amount); the runner
 * is paid ONLY through RunnerEarning → withdraw (delivery fee). Nothing pays twice.
 */

const fail = (statusCode: number, message: string) => ({ statusCode, message });

/** Most deliveries a runner can carry at once */
const MAX_ACTIVE_RUNS = 3;
/** Nigeria has no DST; servers run in UTC */
const LAGOS_TZ = 'Africa/Lagos';

function notify(input: { userId: string; type: string; title: string; body: string; data?: Record<string, any> }) {
  try {
    const { createNotification } = require('../notification/notification.service');
    return createNotification(input).catch((e: any) => console.error('[Runner] notify failed:', e?.message));
  } catch (e) {
    console.error('[Runner] notification module error:', e);
  }
}

function emit(userIds: Array<string | null | undefined>, event: string, payload: unknown) {
  try {
    require('../../lib/socket').emitToUsers(userIds, event, payload);
  } catch (e) {
    console.error(`[Runner] socket emit ${event} failed:`, e);
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseMinutes(timeStr: string): number {
  const m = timeStr?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** 6-digit code the seller reads to the runner at pickup */
export function generatePickupCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

async function requireRunner(userId: string) {
  const runner = await prisma.runner.findUnique({ where: { user_id: userId } });
  if (!runner) throw fail(404, 'Runner profile not found. Register as a runner first.');
  return runner;
}

function requireActive(runner: { status: string }) {
  if (runner.status === 'pending') throw fail(403, 'Your runner account is still being reviewed. We’ll notify you once it’s approved.');
  if (runner.status !== 'active') throw fail(403, 'Your runner account is not active. Contact support.');
}

// ─── Registration & profile ──────────────────────────────────────────────────

export interface RegisterRunnerInput {
  full_name: string;
  phone: string;
  email: string;
  vehicle_type: 'bicycle' | 'motorcycle' | 'car' | 'scooter';
  plate_number?: string;
  vehicle_color?: string;
  address: string;
  operating_lat: number;
  operating_lng: number;
  operating_radius_km: number;
  available_days: string[];
  start_time: string;
  end_time: string;
  profile_photo_url?: string | null;
  vehicle_photo_url?: string | null;
}

export async function registerRunner(userId: string, input: RegisterRunnerInput) {
  const existing = await prisma.runner.findUnique({ where: { user_id: userId } });
  if (existing) throw fail(409, 'You are already registered as a runner');

  const [runner] = await prisma.$transaction([
    prisma.runner.create({
      data: {
        user_id: userId,
        full_name: input.full_name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        vehicle_type: input.vehicle_type,
        plate_number: input.plate_number?.trim() || null,
        vehicle_color: input.vehicle_color?.trim() || null,
        operating_lat: input.operating_lat,
        operating_lng: input.operating_lng,
        operating_address: input.address.trim(),
        operating_radius_km: input.operating_radius_km,
        available_days: input.available_days,
        start_time: input.start_time,
        end_time: input.end_time,
        profile_photo_url: input.profile_photo_url ?? null,
        vehicle_photo_url: input.vehicle_photo_url ?? null,
        status: 'pending', // admin approves
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { is_runner: true, phone: input.phone.trim() } }),
  ]);
  return runner;
}

export async function getRunnerByUserId(userId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
    include: { user: { select: { id: true, email: true, full_name: true, avatar_url: true, is_runner: true } } },
  });
  if (!runner) throw fail(404, 'Runner profile not found');
  return runner;
}

export async function updateRunnerStatus(userId: string, isOnline: boolean) {
  const runner = await requireRunner(userId);
  if (isOnline) requireActive(runner);
  return prisma.runner.update({ where: { id: runner.id }, data: { is_online: isOnline } });
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

function lagosNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LAGOS_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { day: get('weekday'), time: `${get('hour').replace('24', '00')}:${get('minute')}` };
}

/** Within the runner's saved schedule (Lagos time)? */
export function withinSchedule(runner: { available_days: string[]; start_time: string; end_time: string }) {
  const { day, time } = lagosNow();
  return runner.available_days.includes(day) && time >= runner.start_time && time <= runner.end_time;
}

function jobView(job: any, from: { lat: number; lng: number }) {
  return {
    id: job.id,
    order_id: job.order_id,
    pickup_address: job.pickup_address,
    pickup_lat: job.pickup_lat,
    pickup_lng: job.pickup_lng,
    dropoff_address: job.dropoff_address,
    dropoff_lat: job.dropoff_lat,
    dropoff_lng: job.dropoff_lng,
    /** pickup → drop-off */
    trip_km: Math.round(job.distance_km * 10) / 10,
    /** runner → pickup */
    to_pickup_km: Math.round(calculateDistance(from.lat, from.lng, job.pickup_lat, job.pickup_lng) * 10) / 10,
    estimated_time: job.estimated_time,
    delivery_fee: job.delivery_fee,
    items: job.items,
    special_instructions: job.special_instructions,
    status: job.status,
    created_at: job.created_at,
    seller_name: job.order?.vendor?.shop_name ?? null,
  };
}

/**
 * Open jobs near the runner. Being online overrides the saved schedule (they chose to work).
 * Order-linked jobs never silently expire — the buyer has already paid.
 */
export async function listAvailableJobs(
  userId: string,
  filter: 'all' | 'nearest' | 'highest_pay' | 'fastest' = 'all',
  runnerLat?: number,
  runnerLng?: number,
  limit = 20,
  offset = 0,
) {
  const runner = await requireRunner(userId);
  const from = { lat: runnerLat ?? runner.operating_lat, lng: runnerLng ?? runner.operating_lng };

  const jobs = await prisma.deliveryJob.findMany({
    where: {
      status: 'pending',
      OR: [{ order_id: { not: null } }, { expires_at: { gt: new Date() } }],
      deliveryRuns: { none: {} },
    },
    include: { order: { select: { vendor: { select: { shop_name: true } } } } },
    take: 300,
    orderBy: { created_at: 'desc' },
  });

  let list = jobs
    .map((j) => jobView(j, from))
    .filter((j) => j.to_pickup_km <= runner.operating_radius_km);

  switch (filter) {
    case 'nearest': list.sort((a, b) => a.to_pickup_km - b.to_pickup_km); break;
    case 'highest_pay': list.sort((a, b) => b.delivery_fee - a.delivery_fee); break;
    case 'fastest': list.sort((a, b) => parseMinutes(a.estimated_time) - parseMinutes(b.estimated_time)); break;
    default: break; // newest first
  }
  return list.slice(offset, offset + limit);
}

export async function getJobDetail(userId: string, jobId: string) {
  const runner = await requireRunner(userId);
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: {
      deliveryRuns: { select: { id: true, runner_id: true, status: true } },
      order: { select: { vendor: { select: { shop_name: true } } } },
    },
  });
  if (!job) throw fail(404, 'Job not found');
  const myRun = job.deliveryRuns.find((r) => r.runner_id === runner.id) ?? null;
  return {
    ...jobView(job, { lat: runner.operating_lat, lng: runner.operating_lng }),
    is_available: job.status === 'pending' && job.deliveryRuns.length === 0,
    my_run_id: myRun?.id ?? null,
  };
}

/** Claim a job. Two runners tapping at once can't both get it. */
export async function acceptJob(userId: string, jobId: string) {
  const runner = await requireRunner(userId);
  requireActive(runner);
  if (!runner.is_online) throw fail(400, 'Go online to accept jobs');

  const active = await prisma.deliveryRun.count({
    where: { runner_id: runner.id, status: { in: ['assigned', 'picked_up', 'in_transit'] } },
  });
  if (active >= MAX_ACTIVE_RUNS) throw fail(400, `Finish one of your ${active} active deliveries first`);

  const run = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deliveryJob.updateMany({
      where: { id: jobId, status: 'pending', deliveryRuns: { none: {} } },
      data: { status: 'assigned' },
    });
    if (claimed.count === 0) throw fail(409, 'Another runner just took this job');
    return tx.deliveryRun.create({ data: { job_id: jobId, runner_id: runner.id, status: 'assigned' } });
  });

  // Let others drop it from their list, and tell the seller + buyer
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: { order: { select: { id: true, buyer_id: true, vendor_user_id: true } } },
  });
  emit(await onlineRunnerUserIds(), 'runner_job_taken', { job_id: jobId });
  if (job?.order) {
    await prisma.order.update({ where: { id: job.order.id }, data: { status: 'confirmed' } }).catch(() => {});
    notify({ userId: job.order.vendor_user_id, type: 'delivery_update', title: 'Runner on the way', body: `${runner.full_name} is coming to pick up the order. Have your pickup code ready.`, data: { order_id: job.order.id } });
    notify({ userId: job.order.buyer_id, type: 'delivery_update', title: 'Runner assigned', body: `${runner.full_name} will deliver your order.`, data: { order_id: job.order.id } });
    emit([job.order.buyer_id, job.order.vendor_user_id], 'order_delivery_update', { order_id: job.order.id, status: 'assigned' });
  }
  return run;
}

export async function declineJob(_userId: string, _jobId: string) {
  // Nothing to record yet — the job stays open for others
  return { success: true };
}

async function onlineRunnerUserIds() {
  const rows = await prisma.runner.findMany({ where: { is_online: true, status: 'active' }, select: { user_id: true } });
  return rows.map((r) => r.user_id);
}

/** Tell online runners whose area covers the pickup point that a new job is up. */
export async function notifyRunnersOfJob(jobId: string) {
  const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const runners = await prisma.runner.findMany({
    where: { is_online: true, status: 'active' },
    select: { user_id: true, operating_lat: true, operating_lng: true, operating_radius_km: true },
  });
  const nearby = runners.filter((r) => calculateDistance(r.operating_lat, r.operating_lng, job.pickup_lat, job.pickup_lng) <= r.operating_radius_km);
  emit(nearby.map((r) => r.user_id), 'runner_job_new', { job_id: job.id, delivery_fee: job.delivery_fee });
  for (const r of nearby.slice(0, 50)) {
    notify({
      userId: r.user_id,
      type: 'runner_job',
      title: `New delivery · ₦${Math.round(job.delivery_fee).toLocaleString()}`,
      body: `${job.pickup_address} → ${job.dropoff_address}`,
      data: { job_id: job.id },
    });
  }
}

// ─── Runs ────────────────────────────────────────────────────────────────────

const runInclude = {
  job: {
    include: {
      order: {
        select: {
          id: true, amount: true, description: true, status: true, delivery_address: true,
          buyer: { select: { full_name: true, phone: true } },
          vendor: { select: { shop_name: true, phone: true, address: true } },
        },
      },
    },
  },
} as const;

function runView(run: any) {
  const job = run.job;
  const order = job?.order;
  return {
    id: run.id,
    job_id: run.job_id,
    order_id: job?.order_id ?? null,
    status: run.status as 'assigned' | 'picked_up' | 'in_transit' | 'delivered',
    assigned_at: run.assigned_at,
    picked_up_at: run.picked_up_at,
    delivered_at: run.delivered_at,
    pickup_address: job.pickup_address,
    pickup_lat: job.pickup_lat,
    pickup_lng: job.pickup_lng,
    dropoff_address: job.dropoff_address,
    dropoff_lat: job.dropoff_lat,
    dropoff_lng: job.dropoff_lng,
    trip_km: Math.round(job.distance_km * 10) / 10,
    estimated_time: job.estimated_time,
    delivery_fee: job.delivery_fee,
    items: job.items ?? [],
    special_instructions: job.special_instructions,
    order_description: order?.description ?? null,
    seller_name: order?.vendor?.shop_name ?? 'Seller',
    seller_phone: order?.vendor?.phone ?? null,
    buyer_name: order?.buyer?.full_name ?? 'Buyer',
    buyer_phone: order?.buyer?.phone ?? null,
  };
}

export async function listActiveRuns(userId: string, scope: 'active' | 'completed' = 'active') {
  const runner = await requireRunner(userId);
  const runs = await prisma.deliveryRun.findMany({
    where: {
      runner_id: runner.id,
      status: scope === 'active' ? { in: ['assigned', 'picked_up', 'in_transit'] } : 'delivered',
    },
    include: runInclude,
    orderBy: scope === 'active' ? { assigned_at: 'desc' } : { delivered_at: 'desc' },
    take: scope === 'active' ? 20 : 50,
  });
  return runs.map(runView);
}

export async function getRunDetail(userId: string, runId: string) {
  const runner = await requireRunner(userId);
  const run = await prisma.deliveryRun.findUnique({ where: { id: runId }, include: runInclude });
  if (!run) throw fail(404, 'Delivery not found');
  if (run.runner_id !== runner.id) throw fail(403, 'This delivery is assigned to another runner');
  return runView(run);
}

/**
 * Manual status changes are limited to "on my way to the buyer" (picked_up → in_transit).
 * Pickup needs the seller's code and delivery needs the buyer's code — see below.
 */
export async function updateRunStatus(userId: string, runId: string, status: 'picked_up' | 'in_transit' | 'delivered') {
  if (status === 'picked_up') throw fail(400, "Enter the seller's pickup code to confirm pickup");
  if (status === 'delivered') throw fail(400, "Enter the buyer's delivery code to confirm delivery");
  const runner = await requireRunner(userId);
  const run = await prisma.deliveryRun.findUnique({ where: { id: runId }, include: { job: true } });
  if (!run || run.runner_id !== runner.id) throw fail(404, 'Delivery not found');
  if (run.status !== 'picked_up') throw fail(400, 'Pick up the order first');
  await prisma.deliveryRun.update({ where: { id: runId }, data: { status: 'in_transit' } });
  return getRunDetail(userId, runId);
}

/** Pickup: runner enters the seller's code (or scans its QR). */
export async function scanPickupQr(userId: string, orderId: string, code: string) {
  const runner = await requireRunner(userId);
  requireActive(runner);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryJob: { include: { deliveryRuns: true } } },
  });
  if (!order || !order.deliveryJob) throw fail(404, 'Delivery not found');
  const run = order.deliveryJob.deliveryRuns.find((r) => r.runner_id === runner.id);
  if (!run) throw fail(403, 'Accept this job before picking it up');
  if (run.status !== 'assigned') throw fail(400, 'Already picked up');
  if (!order.pickup_qr || order.pickup_qr !== String(code ?? '').trim()) throw fail(400, 'That pickup code is wrong. Ask the seller to check it.');

  const now = new Date();
  await prisma.$transaction([
    prisma.deliveryRun.update({ where: { id: run.id }, data: { status: 'picked_up', picked_up_at: now } }),
    prisma.order.update({ where: { id: orderId }, data: { pickup_confirmed_at: now, status: 'in_transit' } }),
  ]);

  notify({ userId: order.buyer_id, type: 'delivery_update', title: 'Your order is on the way 🛵', body: `${runner.full_name} has picked it up. Have your delivery code ready.`, data: { order_id: orderId } });
  notify({ userId: order.vendor_user_id, type: 'delivery_update', title: 'Order picked up', body: `${runner.full_name} collected the order.`, data: { order_id: orderId } });
  emit([order.buyer_id, order.vendor_user_id], 'order_delivery_update', { order_id: orderId, status: 'picked_up' });

  return getRunDetail(userId, run.id);
}

/**
 * Drop-off: runner enters the buyer's delivery code (the one shown in their Orders).
 * Same effect as the vendor verifying the code: escrow releases after the hold window.
 */
export async function scanDeliveryQr(userId: string, orderId: string, code: string) {
  const runner = await requireRunner(userId);
  requireActive(runner);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryJob: { include: { deliveryRuns: true } } },
  });
  if (!order || !order.deliveryJob) throw fail(404, 'Delivery not found');
  const run = order.deliveryJob.deliveryRuns.find((r) => r.runner_id === runner.id);
  if (!run) throw fail(403, 'You are not assigned to this delivery');
  if (run.status === 'delivered') throw fail(400, 'Delivery already confirmed');
  if (run.status === 'assigned') throw fail(400, 'Confirm pickup first');

  const entered = String(code ?? '').trim();
  const valid = (!!order.otp_code && entered === order.otp_code) || (!!order.delivery_qr && entered === order.delivery_qr);
  if (!valid) throw fail(400, "That delivery code is wrong. Ask the buyer to read it from their Orders page.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const done = await tx.deliveryRun.updateMany({
      where: { id: run.id, status: { not: 'delivered' } },
      data: { status: 'delivered', delivered_at: now },
    });
    if (done.count === 0) throw fail(400, 'Delivery already confirmed');

    // One earning per run. Pending until escrow settles, then withdrawable.
    const existing = await tx.runnerEarning.findFirst({ where: { run_id: run.id } });
    if (!existing) {
      await tx.runnerEarning.create({
        data: { runner_id: runner.id, run_id: run.id, amount: order.deliveryJob!.delivery_fee, status: 'pending', completed_at: now },
      });
    }
    await tx.runner.update({ where: { id: runner.id }, data: { total_deliveries: { increment: 1 } } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'delivered',
        delivery_confirmed_at: now,
        // Same as a verified delivery code: the escrow cron pays the vendor after the hold
        otp_confirmed: true,
        otp_confirmed_at: now,
        auto_release_at: escrowHoldReleaseAt(),
      },
    });
  });

  notify({ userId: order.buyer_id, type: 'delivery_update', title: 'Delivered ✅', body: 'Your order was delivered. Something wrong? Open a dispute from Orders within 2 hours.', data: { order_id: orderId } });
  notify({ userId: order.vendor_user_id, type: 'delivery_update', title: 'Order delivered', body: 'Payment releases to your wallet after a short hold.', data: { order_id: orderId } });
  emit([order.buyer_id, order.vendor_user_id], 'order_delivery_update', { order_id: orderId, status: 'delivered' });

  return { success: true, message: 'Delivery confirmed. Your fee is added to earnings and becomes withdrawable once the order settles.' };
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export async function listEarnings(userId: string, filter: 'today' | 'week' | 'month' | 'all' = 'all', limit = 20, offset = 0) {
  const runner = await requireRunner(userId);
  const start = new Date();
  if (filter === 'today') start.setHours(0, 0, 0, 0);
  else if (filter === 'week') start.setDate(start.getDate() - 7);
  else if (filter === 'month') start.setMonth(start.getMonth() - 1);
  else start.setTime(0);

  return prisma.runnerEarning.findMany({
    where: { runner_id: runner.id, completed_at: { gte: start } },
    orderBy: { completed_at: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getRunnerBalance(userId: string) {
  const runner = await requireRunner(userId);
  const sum = async (status?: string) =>
    (await prisma.runnerEarning.aggregate({ where: { runner_id: runner.id, ...(status ? { status } : {}) }, _sum: { amount: true } }))._sum.amount ?? 0;
  const [available, pending, paid, total] = await Promise.all([sum('available'), sum('pending'), sum('paid'), sum()]);
  return { available, pending, paid, total };
}

/**
 * Move ALL withdrawable earnings into the runner's Vendr wallet (atomic).
 * (Partial amounts used to mark whole earnings as paid — money went missing.)
 */
export async function withdrawEarnings(userId: string, _amount?: number) {
  const runner = await requireRunner(userId);
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.runnerEarning.findMany({ where: { runner_id: runner.id, status: 'available' }, select: { id: true, amount: true } });
    if (rows.length === 0) throw fail(400, 'Nothing to withdraw yet');
    const ids = rows.map((r) => r.id);
    const moved = await tx.runnerEarning.updateMany({ where: { id: { in: ids }, status: 'available' }, data: { status: 'paid', paid_at: new Date() } });
    if (moved.count !== rows.length) throw fail(409, 'Your balance changed — please try again');
    const total = rows.reduce((s, r) => s + r.amount, 0);
    await tx.wallet.upsert({
      where: { user_id: userId },
      create: { user_id: userId, available_balance: total, frozen_balance: 0 },
      update: { available_balance: { increment: total } },
    });
    await tx.transaction.create({
      data: { user_id: userId, type: 'credit', amount: total, status: 'success', description: 'Runner earnings', metadata: { earning_ids: ids } },
    });
    return total;
  });
  return { success: true, amount: result };
}

export async function getDashboardStats(userId: string) {
  const runner = await requireRunner(userId);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [balance, activeRuns, weekDeliveries, weekEarnings, todayEarnings] = await Promise.all([
    getRunnerBalance(userId),
    prisma.deliveryRun.count({ where: { runner_id: runner.id, status: { in: ['assigned', 'picked_up', 'in_transit'] } } }),
    prisma.deliveryRun.count({ where: { runner_id: runner.id, status: 'delivered', delivered_at: { gte: weekAgo } } }),
    prisma.runnerEarning.aggregate({ where: { runner_id: runner.id, completed_at: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.runnerEarning.aggregate({ where: { runner_id: runner.id, completed_at: { gte: todayStart } }, _sum: { amount: true } }),
  ]);

  return {
    status: runner.status,
    is_online: runner.is_online,
    within_schedule: withinSchedule(runner),
    total_deliveries: runner.total_deliveries,
    rating: runner.rating,
    total_earnings: balance.total,
    available_balance: balance.available,
    pending_balance: balance.pending,
    active_runs: activeRuns,
    this_week_deliveries: weekDeliveries,
    this_week_earnings: weekEarnings._sum.amount ?? 0,
    today_earnings: todayEarnings._sum.amount ?? 0,
  };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function adminListRunners(params: { status?: string; search?: string } = {}) {
  const where: any = {};
  if (params.status && ['pending', 'active', 'suspended'].includes(params.status)) where.status = params.status;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { full_name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { operating_address: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [runners, counts] = await Promise.all([
    prisma.runner.findMany({ where, orderBy: { created_at: 'desc' }, take: 200 }),
    prisma.runner.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    runners,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
}

/** Approve (active), suspend, or send back to review. Approved runners are told they can start. */
export async function adminSetRunnerStatus(runnerId: string, status: string, reason?: string) {
  if (!['pending', 'active', 'suspended'].includes(status)) throw fail(400, 'status must be pending, active or suspended');
  const runner = await prisma.runner.findUnique({ where: { id: runnerId } });
  if (!runner) throw fail(404, 'Runner not found');

  const updated = await prisma.runner.update({
    where: { id: runnerId },
    // Suspended runners are taken offline so they stop getting jobs
    data: { status, ...(status !== 'active' ? { is_online: false } : {}) },
  });

  if (status === 'active' && runner.status !== 'active') {
    notify({ userId: runner.user_id, type: 'runner_status', title: "You're approved! 🎉", body: 'Switch on Runner Mode and go online to start taking delivery jobs.', data: {} });
  } else if (status === 'suspended') {
    notify({ userId: runner.user_id, type: 'runner_status', title: 'Runner account suspended', body: reason?.trim() || 'Contact support for details.', data: {} });
  }
  return updated;
}
