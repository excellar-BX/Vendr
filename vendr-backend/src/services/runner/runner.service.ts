import prisma from '../../lib/prisma';

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

/**
 * Register a user as a runner
 * Creates runner profile and updates user's is_runner flag
 */
export async function registerRunner(userId: string, input: RegisterRunnerInput) {
  // Check if user is already a runner
  const existingRunner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (existingRunner) {
    throw new Error('User is already registered as a runner');
  }

  // Create runner profile
  const runner = await prisma.runner.create({
    data: {
      user_id: userId,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      vehicle_type: input.vehicle_type,
      plate_number: input.plate_number,
      vehicle_color: input.vehicle_color,
      operating_lat: input.operating_lat,
      operating_lng: input.operating_lng,
      operating_address: input.address,
      operating_radius_km: input.operating_radius_km,
      available_days: input.available_days,
      start_time: input.start_time,
      end_time: input.end_time,
      profile_photo_url: input.profile_photo_url,
      vehicle_photo_url: input.vehicle_photo_url,
      status: 'pending', // Requires admin approval
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          phone: true,
          is_runner: true,
        },
      },
    },
  });

  // Update user's is_runner flag
  await prisma.user.update({
    where: { id: userId },
    data: {
      is_runner: true,
      phone: input.phone,
    },
  });

  return runner;
}

/**
 * Get runner profile by user ID
 */
export async function getRunnerByUserId(userId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          full_name: true,
          avatar_url: true,
          is_runner: true,
        },
      },
    },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  return runner;
}

/**
 * Update runner online/offline status
 */
export async function updateRunnerStatus(userId: string, isOnline: boolean) {
  const runner = await prisma.runner.update({
    where: { user_id: userId },
    data: { is_online: isOnline },
  });

  return runner;
}

/**
 * List available delivery jobs for a runner
 * Filters by operating radius, availability, and selected sort option
 */
export async function listAvailableJobs(
  userId: string,
  filter: 'all' | 'nearest' | 'highest_pay' | 'fastest' = 'all',
  runnerLat?: number,
  runnerLng?: number,
  limit = 20,
  offset = 0,
) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  // Get runner's location if not provided
  const lat = runnerLat ?? runner.operating_lat;
  const lng = runnerLng ?? runner.operating_lng;

  // Get current day and time
  const now = new Date();
  const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Find available jobs
  let jobs = await prisma.deliveryJob.findMany({
    where: {
      status: 'pending',
      expires_at: { gt: now },
    },
    include: {
      deliveryRuns: true,
    },
  });

  // Filter out already assigned jobs
  jobs = jobs.filter(job => job.deliveryRuns.length === 0);

  // Filter by operating radius (distance from runner to pickup)
  jobs = jobs.filter(job => {
    const distance = calculateDistance(lat, lng, job.pickup_lat, job.pickup_lng);
    return distance <= runner.operating_radius_km;
  });

  // Filter by availability (day and time)
  jobs = jobs.filter(job => {
    const isAvailableDay = runner.available_days.includes(currentDay);
    const isAvailableTime = currentTime >= runner.start_time && currentTime <= runner.end_time;
    return isAvailableDay && isAvailableTime;
  });

  // Sort based on filter
  switch (filter) {
    case 'nearest':
      jobs.sort((a, b) => {
        const distA = calculateDistance(lat, lng, a.pickup_lat, a.pickup_lng);
        const distB = calculateDistance(lat, lng, b.pickup_lat, b.pickup_lng);
        return distA - distB;
      });
      break;
    case 'highest_pay':
      jobs.sort((a, b) => b.delivery_fee - a.delivery_fee);
      break;
    case 'fastest':
      jobs.sort((a, b) => {
        const timeA = parseTime(a.estimated_time);
        const timeB = parseTime(b.estimated_time);
        return timeA - timeB;
      });
      break;
    default:
      // all - sort by created_at desc
      jobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Add distance to each job
  jobs = jobs.map(job => ({
    ...job,
    distance_km: calculateDistance(lat, lng, job.pickup_lat, job.pickup_lng),
  }));

  return jobs.slice(offset, offset + limit);
}

/**
 * Accept a delivery job
 */
export async function acceptJob(userId: string, jobId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  if (!runner.is_online) {
    throw new Error('Runner must be online to accept jobs');
  }

  if (runner.status !== 'active') {
    throw new Error('Runner account is not active');
  }

  // Check if job exists and is available
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: { deliveryRuns: true },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'pending') {
    throw new Error('Job is no longer available');
  }

  if (job.expires_at < new Date()) {
    throw new Error('Job has expired');
  }

  if (job.deliveryRuns.length > 0) {
    throw new Error('Job has already been assigned');
  }

  // Create delivery run
  const run = await prisma.deliveryRun.create({
    data: {
      job_id: jobId,
      runner_id: runner.id,
      status: 'assigned',
    },
    include: {
      job: true,
    },
  });

  // Update job status
  await prisma.deliveryJob.update({
    where: { id: jobId },
    data: { status: 'assigned' },
  });

  return run;
}

/**
 * Get job details by ID
 */
export async function getJobDetail(jobId: string) {
  const job = await prisma.deliveryJob.findUnique({
    where: { id: jobId },
    include: {
      deliveryRuns: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  return job;
}

/**
 * Decline a job (optional - for tracking)
 */
export async function declineJob(userId: string, jobId: string) {
  // Just return success - job remains available for others
  return { success: true };
}

/**
 * List active runs for a runner
 */
export async function listActiveRuns(userId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const runs = await prisma.deliveryRun.findMany({
    where: {
      runner_id: runner.id,
      status: { in: ['assigned', 'picked_up', 'in_transit'] },
    },
    include: {
      job: true,
    },
    orderBy: { assigned_at: 'desc' },
  });

  return runs;
}

/**
 * Get run details by ID
 */
export async function getRunDetail(userId: string, runId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const run = await prisma.deliveryRun.findUnique({
    where: { id: runId },
    include: {
      job: true,
    },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  if (run.runner_id !== runner.id) {
    throw new Error('Unauthorized');
  }

  return run;
}

/**
 * Update run status (picked_up, in_transit, delivered)
 */
export async function updateRunStatus(
  userId: string,
  runId: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
  pickupPhotoUrl?: string,
  deliveryPhotoUrl?: string,
) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const run = await prisma.deliveryRun.findUnique({
    where: { id: runId },
    include: { job: true },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  if (run.runner_id !== runner.id) {
    throw new Error('Unauthorized');
  }

  const updateData: any = { status };

  if (status === 'picked_up') {
    updateData.picked_up_at = new Date();
    updateData.pickup_photo_url = pickupPhotoUrl;

    // Update order status if linked
    if (run.job.order_id) {
      await prisma.order.update({
        where: { id: run.job.order_id },
        data: {
          pickup_confirmed_at: new Date(),
          status: 'in_transit',
        },
      });
    }
  } else if (status === 'in_transit') {
    // Can transition from picked_up to in_transit
  } else if (status === 'delivered') {
    updateData.delivered_at = new Date();
    updateData.delivery_photo_url = deliveryPhotoUrl;

    // Create earning record
    await prisma.runnerEarning.create({
      data: {
        runner_id: runner.id,
        run_id: runId,
        amount: run.job.delivery_fee,
        status: 'pending',
        completed_at: new Date(),
      },
    });

    // Update runner stats
    await prisma.runner.update({
      where: { id: runner.id },
      data: {
        total_deliveries: { increment: 1 },
      },
    });

    // Update order status if linked
    if (run.job.order_id) {
      await prisma.order.update({
        where: { id: run.job.order_id },
        data: {
          delivery_confirmed_at: new Date(),
          status: 'delivered',
        },
      });
    }
  }

  const updatedRun = await prisma.deliveryRun.update({
    where: { id: runId },
    data: updateData,
    include: { job: true },
  });

  return updatedRun;
}

/**
 * Scan pickup QR code (seller → runner handoff)
 */
export async function scanPickupQr(userId: string, orderId: string, qrToken: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryJob: { include: { deliveryRuns: true } } },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.pickup_qr !== qrToken) {
    throw new Error('Invalid QR code');
  }

  if (order.qr_expires_at && order.qr_expires_at < new Date()) {
    throw new Error('QR code has expired');
  }

  if (!order.deliveryJob) {
    throw new Error('No delivery job found for this order');
  }

  // Find or create delivery run for this runner
  let run = order.deliveryJob.deliveryRuns.find(r => r.runner_id === runner.id);

  if (!run) {
    // Check if job is already assigned to another runner
    if (order.deliveryJob.deliveryRuns.length > 0) {
      throw new Error('This delivery is already assigned to another runner');
    }

    // Create new delivery run
    run = await prisma.deliveryRun.create({
      data: {
        job_id: order.deliveryJob.id,
        runner_id: runner.id,
        status: 'picked_up',
        picked_up_at: new Date(),
      },
    });

    // Update job status
    await prisma.deliveryJob.update({
      where: { id: order.deliveryJob.id },
      data: { status: 'assigned' },
    });
  } else {
    // Update existing run
    run = await prisma.deliveryRun.update({
      where: { id: run.id },
      data: {
        status: 'picked_up',
        picked_up_at: new Date(),
      },
    });
  }

  // Update order
  await prisma.order.update({
    where: { id: orderId },
    data: {
      pickup_confirmed_at: new Date(),
      status: 'in_transit',
    },
  });

  return run;
}

/**
 * Scan delivery QR code (runner → buyer handoff)
 * Triggers escrow release
 */
export async function scanDeliveryQr(userId: string, orderId: string, qrToken: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryJob: { include: { deliveryRuns: true } } },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.delivery_qr !== qrToken) {
    throw new Error('Invalid QR code');
  }

  if (order.qr_expires_at && order.qr_expires_at < new Date()) {
    throw new Error('QR code has expired');
  }

  if (!order.deliveryJob) {
    throw new Error('No delivery job found for this order');
  }

  const run = order.deliveryJob.deliveryRuns.find(r => r.runner_id === runner.id);

  if (!run) {
    throw new Error('You are not assigned to this delivery');
  }

  if (run.status === 'delivered') {
    throw new Error('Delivery already confirmed');
  }

  // Update run status
  await prisma.deliveryRun.update({
    where: { id: run.id },
    data: {
      status: 'delivered',
      delivered_at: new Date(),
    },
  });

  // Create earning record
  await prisma.runnerEarning.create({
    data: {
      runner_id: runner.id,
      run_id: run.id,
      amount: order.deliveryJob?.delivery_fee || 0,
      status: 'pending',
      completed_at: new Date(),
    },
  });

  // Update runner stats
  await prisma.runner.update({
    where: { id: runner.id },
    data: {
      total_deliveries: { increment: 1 },
    },
  });

  // Update order
  await prisma.order.update({
    where: { id: orderId },
    data: {
      delivery_confirmed_at: new Date(),
      status: 'delivered',
    },
  });

  // Trigger escrow release
  await releaseEscrow(orderId);

  return { success: true, message: 'Delivery confirmed, escrow released' };
}

/**
 * Release escrow for an order
 * Splits payment: item price → seller (minus platform fee), delivery fee → runner
 */
async function releaseEscrow(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryJob: true },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.escrow_status === 'released') {
    return; // Already released
  }

  const itemAmount = order.amount - (order.delivery_fee || 0);
  const deliveryFee = order.delivery_fee || 0;
  const platformFee = 50; // ₦50 flat fee per transaction

  // Seller receives item amount minus platform fee
  const sellerPayout = itemAmount - platformFee;

  // Credit seller's wallet (item amount minus platform fee)
  await prisma.wallet.upsert({
    where: { user_id: order.vendor_user_id },
    create: {
      user_id: order.vendor_user_id,
      available_balance: sellerPayout,
      frozen_balance: 0,
    },
    update: {
      available_balance: { increment: sellerPayout },
    },
  });

  // Create transaction for seller
  await prisma.transaction.create({
    data: {
      user_id: order.vendor_user_id,
      type: 'credit',
      amount: sellerPayout,
      status: 'success',
      description: `Order ${orderId} - item payment (₦${platformFee} platform fee deducted)`,
    },
  });

  // Create platform fee transaction (for Vendr's accounting)
  await prisma.transaction.create({
    data: {
      user_id: order.vendor_user_id, // Linked to order for tracking
      type: 'debit',
      amount: platformFee,
      status: 'success',
      description: `Order ${orderId} - platform fee`,
      metadata: { type: 'platform_fee' },
    },
  });

  // Credit runner's wallet (delivery fee) if there's a delivery job
  if (order.deliveryJob) {
    const run = await prisma.deliveryRun.findFirst({
      where: { job_id: order.deliveryJob.id },
    });

    if (run) {
      await prisma.wallet.upsert({
        where: { user_id: run.runner_id },
        create: {
          user_id: run.runner_id,
          available_balance: deliveryFee,
          frozen_balance: 0,
        },
        update: {
          available_balance: { increment: deliveryFee },
        },
      });

      // Create transaction for runner
      await prisma.transaction.create({
        data: {
          user_id: run.runner_id,
          type: 'credit',
          amount: deliveryFee,
          status: 'success',
          description: `Order ${orderId} - delivery fee`,
        },
      });

      // Mark earning as available
      await prisma.runnerEarning.updateMany({
        where: {
          run_id: run.id,
          status: 'pending',
        },
        data: {
          status: 'available',
        },
      });
    }
  }

  // Update order escrow status
  await prisma.order.update({
    where: { id: orderId },
    data: { escrow_status: 'released' },
  });
}

/**
 * List runner earnings
 */
export async function listEarnings(
  userId: string,
  filter: 'today' | 'week' | 'month' | 'all' = 'all',
  limit = 20,
  offset = 0,
) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const now = new Date();
  let startDate: Date;

  switch (filter) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      startDate = new Date(0);
  }

  const earnings = await prisma.runnerEarning.findMany({
    where: {
      runner_id: runner.id,
      completed_at: { gte: startDate },
    },
    orderBy: { completed_at: 'desc' },
    take: limit,
    skip: offset,
  });

  return earnings;
}

/**
 * Get runner balance (available earnings)
 */
export async function getRunnerBalance(userId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const available = await prisma.runnerEarning.aggregate({
    where: {
      runner_id: runner.id,
      status: 'available',
    },
    _sum: {
      amount: true,
    },
  });

  const pending = await prisma.runnerEarning.aggregate({
    where: {
      runner_id: runner.id,
      status: 'pending',
    },
    _sum: {
      amount: true,
    },
  });

  const total = await prisma.runnerEarning.aggregate({
    where: {
      runner_id: runner.id,
    },
    _sum: {
      amount: true,
    },
  });

  return {
    available: available._sum.amount || 0,
    pending: pending._sum.amount || 0,
    total: total._sum.amount || 0,
  };
}

/**
 * Withdraw earnings to wallet
 */
export async function withdrawEarnings(userId: string, amount: number) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  // Check available balance
  const balance = await getRunnerBalance(userId);

  if (balance.available < amount) {
    throw new Error('Insufficient available balance');
  }

  // Mark earnings as paid
  const earningsToPay = await prisma.runnerEarning.findMany({
    where: {
      runner_id: runner.id,
      status: 'available',
    },
    orderBy: { completed_at: 'asc' },
  });

  let remaining = amount;
  const paidEarnings: string[] = [];

  for (const earning of earningsToPay) {
    if (remaining <= 0) break;

    const payAmount = Math.min(remaining, earning.amount);
    await prisma.runnerEarning.update({
      where: { id: earning.id },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    paidEarnings.push(earning.id);
    remaining -= payAmount;
  }

  // Credit to user's wallet
  await prisma.wallet.update({
    where: { user_id: userId },
    data: {
      available_balance: { increment: amount },
    },
  });

  // Create transaction record
  await prisma.transaction.create({
    data: {
      user_id: userId,
      type: 'credit',
      amount,
      status: 'success',
      description: 'Runner earnings withdrawal',
      metadata: { earning_ids: paidEarnings },
    },
  });

  return { success: true, amount };
}

/**
 * Get dashboard stats
 */
export async function getDashboardStats(userId: string) {
  const runner = await prisma.runner.findUnique({
    where: { user_id: userId },
  });

  if (!runner) {
    throw new Error('Runner profile not found');
  }

  const totalDeliveries = runner.total_deliveries;
  const rating = runner.rating;

  const totalEarnings = await prisma.runnerEarning.aggregate({
    where: { runner_id: runner.id },
    _sum: { amount: true },
  });

  const activeRuns = await prisma.deliveryRun.count({
    where: {
      runner_id: runner.id,
      status: { in: ['assigned', 'picked_up', 'in_transit'] },
    },
  });

  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weekDeliveries = await prisma.deliveryRun.count({
    where: {
      runner_id: runner.id,
      status: 'delivered',
      delivered_at: { gte: weekAgo },
    },
  });

  const weekEarnings = await prisma.runnerEarning.aggregate({
    where: {
      runner_id: runner.id,
      completed_at: { gte: weekAgo },
    },
    _sum: { amount: true },
  });

  return {
    total_deliveries: totalDeliveries,
    total_earnings: totalEarnings._sum.amount || 0,
    rating,
    active_runs: activeRuns,
    this_week_deliveries: weekDeliveries,
    this_week_earnings: weekEarnings._sum.amount || 0,
  };
}

// Helper functions

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function parseTime(timeStr: string): number {
  // Parse "15 min" to minutes
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}
