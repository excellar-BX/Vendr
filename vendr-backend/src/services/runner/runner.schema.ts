import { z } from 'zod';

export const registerRunnerSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email('Invalid email'),
  // Accept "Bicycle" / "bicycle" alike (older app builds send the display label)
  vehicle_type: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['bicycle', 'motorcycle', 'car', 'scooter'], { message: 'Choose bicycle, motorcycle, car or scooter' }),
  ),
  plate_number: z.string().optional(),
  vehicle_color: z.string().optional(),
  address: z.string().min(5, 'Address is required'),
  operating_lat: z.number(),
  operating_lng: z.number(),
  operating_radius_km: z.number().min(1).max(50),
  available_days: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  profile_photo_url: z.string().url().optional().nullable(),
  vehicle_photo_url: z.string().url().optional().nullable(),
});

export const updateRunnerStatusSchema = z.object({
  is_online: z.boolean(),
});

// Query strings arrive as text — coerce, or "?lat=6.4" is always rejected
export const listJobsSchema = z.object({
  filter: z.enum(['all', 'nearest', 'highest_pay', 'fastest']).default('all'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const acceptJobSchema = z.object({
  job_id: z.string().uuid(),
});

export const updateRunStatusSchema = z.object({
  status: z.enum(['picked_up', 'in_transit', 'delivered']),
  pickup_photo_url: z.string().url().optional(),
  delivery_photo_url: z.string().url().optional(),
});

export const listEarningsSchema = z.object({
  filter: z.enum(['today', 'week', 'month', 'all']).default('all'),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Withdrawals move everything that's available; amount is accepted for older clients
export const withdrawEarningsSchema = z.object({
  amount: z.number().positive().optional(),
});
