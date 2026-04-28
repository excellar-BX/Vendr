const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// ─── Auth token helpers ───────────────────────────────────────────────────────

export function getAdminToken(): string | null {
  return localStorage.getItem('admin_token')
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function clearAdminToken() {
  localStorage.removeItem('admin_token')
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface FetchOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

export async function adminFetch(path: string, options: FetchOptions = {}): Promise<unknown> {
  const token = getAdminToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let url = `${BASE_URL}${path}`

  if (options.query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value))
      }
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    clearAdminToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const data = await res.json()

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? 'Request failed')
  }

  return data
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  is_verified: boolean
  is_vendor_verified: boolean
  is_buyer: boolean
  is_vendor: boolean
  is_deleted: boolean
  role: string
  plan: string
  created_at: string
  google_id?: string | null
  notifications_enabled?: boolean
  last_withdrawal_at?: string | null
}

export interface Vendor {
  id: string
  user_id: string
  shop_name: string
  description: string | null
  category: string | null
  city: string | null
  address: string | null
  logo_url: string | null
  is_active: boolean
  is_suspended: boolean
  suspended_at: string | null
  suspended_reason: string | null
  is_fraud_flagged: boolean
  fraud_flag_reason: string | null
  rating: number
  review_count: number
  plan: string
  verification_tier: string | null
  created_at: string
  user?: User
}

export interface VerificationRequest {
  id: string
  vendor_id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  reviewer_id: string | null
  rejection_reason: string | null
  cac_number: string | null
  nin_number: string | null
  business_address: string | null
  documents: Record<string, unknown>
  created_at: string
  updated_at: string
  vendor?: Vendor
}

export interface Transaction {
  id: string
  user_id: string
  type: string
  amount: number
  status: string
  reference: string | null
  description: string | null
  provider: string
  created_at: string
  user?: User
}

export interface Order {
  id: string
  buyer_id: string
  vendor_id: string
  status: string
  amount: number
  escrow_status: string
  description: string | null
  created_at: string
  buyer?: User
  vendor?: Vendor
}

export interface Dispute {
  id: string
  order_id: string
  buyer_id: string
  vendor_id: string
  reason: string
  description: string | null
  status: string
  resolution: string | null
  created_at: string
  updated_at: string
  buyer?: User
  vendor?: Vendor
}

export interface DashboardStats {
  users: { total: number; buyers: number; vendors: number; new_this_week: number }
  transactions: { total_volume: number; count: number; today_volume: number }
  orders: { total: number; pending: number; completed: number; disputed: number }
  verifications: { pending: number; approved: number; rejected: number }
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    adminFetch('/admin/login', { method: 'POST', body: { email, password } }),

  // Dashboard
  getStats: () => adminFetch('/admin/stats'),

  // Users
  getUsers: (params?: { limit?: number; offset?: number; search?: string; role?: string }) =>
    adminFetch('/admin/users', { query: params }),

  getUser: (id: string) => adminFetch(`/admin/users/${id}`),

  updateUser: (id: string, data: Partial<User>) =>
    adminFetch(`/admin/users/${id}`, { method: 'PATCH', body: data }),

  deleteUser: (id: string) => adminFetch(`/admin/users/${id}`, { method: 'DELETE' }),

  // Vendors
  getVendors: (params?: { limit?: number; offset?: number; search?: string; is_fraud_flagged?: boolean }) =>
    adminFetch('/admin/vendors', { query: params }),

  getVendor: (id: string) => adminFetch(`/admin/vendors/${id}`),

  flagVendor: (id: string, reason: string) =>
    adminFetch(`/admin/vendors/${id}/flag`, { method: 'POST', body: { reason } }),

  unflagVendor: (id: string) =>
    adminFetch(`/admin/vendors/${id}/unflag`, { method: 'POST' }),

  suspendVendor: (id: string) =>
    adminFetch(`/admin/vendors/${id}/suspend`, { method: 'POST' }),

  unsuspendVendor: (id: string) =>
    adminFetch(`/admin/vendors/${id}/unsuspend`, { method: 'POST' }),

  // Verification
  getVerifications: (params?: { status?: string; limit?: number; offset?: number }) =>
    adminFetch('/admin/verifications', { query: params }),

  getVerification: (id: string) => adminFetch(`/admin/verifications/${id}`),

  approveVerification: (id: string) =>
    adminFetch(`/admin/verifications/${id}/approve`, { method: 'POST' }),

  rejectVerification: (id: string, reason: string) =>
    adminFetch(`/admin/verifications/${id}/reject`, { method: 'POST', body: { reason } }),

  // Transactions
  getTransactions: (params?: { limit?: number; offset?: number; type?: string; status?: string }) =>
    adminFetch('/admin/transactions', { query: params }),

  // Orders
  getOrders: (params?: { limit?: number; offset?: number; status?: string }) =>
    adminFetch('/admin/orders', { query: params }),

  // Disputes
  getDisputes: (params?: { status?: string; limit?: number; offset?: number }) =>
    adminFetch('/admin/disputes', { query: params }),

  resolveDispute: (id: string, resolution: string) =>
    adminFetch(`/admin/disputes/${id}/resolve`, { method: 'POST', body: { resolution } }),

  // Waitlist
  getWaitlist: () => adminFetch('/admin/waitlist'),
}