import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/authStore'


const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.161.22.15:3000/api"
console.log(BASE_URL)
// ─── Token storage ────────────────────────────────────────────────────────────

export async function getAccessToken() {
  return await SecureStore.getItemAsync('access_token')
}

export async function getRefreshToken() {
  return await SecureStore.getItemAsync('refresh_token')
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('access_token', accessToken)
  await SecureStore.setItemAsync('refresh_token', refreshToken)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    // No refresh token means user is not logged in
    await clearTokens()
    useAuthStore.getState().clear()
    return null
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    // Refresh token expired or invalid - user must log in again
    await clearTokens()
    useAuthStore.getState().clear()
    return null
  }

  const data = await res.json()
  await saveTokens(data.data.accessToken, data.data.refreshToken)
  return data.data.accessToken
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiFetchOptions {
  method?: string
  body?: any
  query?: Record<string, any>
  headers?: Record<string, string>
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  retry = true
): Promise<any> {
  const accessToken = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  // Build URL with query params
  let url = `${BASE_URL}${path}`
  if (options.query) {
    const searchParams = new URLSearchParams()
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  // Extract only the properties we want to pass to fetch
  const { query: _query, ...fetchOptions } = options
  // Remove body for GET/DELETE if no body needed
  const method = fetchOptions.method?.toUpperCase()
  if (method === 'GET' || method === 'DELETE') {
    delete fetchOptions.body
  }

  const res = await fetch(url, { ...fetchOptions, headers })

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return apiFetch(path, options, false)
    }
    // Refresh failed — user must log in again
    throw { statusCode: 401, message: 'Your session has expired. Please log in again.' }
  }

  const data = await res.json()

  if (!res.ok) {
    throw { statusCode: res.status, message: data.message ?? 'Something went wrong', errors: data.errors }
  }

  return data
}

// ──────────────────────────────────────────────────────────────
// Search API
// ──────────────────────────────────────────────────────────────

export const vendorApi = {
  /**
   * Get current user's vendor profile
   */
  getMyVendor: () => apiFetch('/vendors/me'),

  /**
   * Get vendors list (with optional filters)
   */
  getVendors: (params?: {
    category?: string
    is_verified?: boolean
    is_active?: boolean
    ids?: string[]  // will be joined as comma-separated
    has_location?: boolean
  }) => {
    const query: any = { ...params };
    if (params?.ids?.length) {
      query.ids = params.ids.join(',');
    }
    return apiFetch('/vendors', { query });
  },
}

export const searchApi = {
  /**
   * Search vendors and products
   */
  search: (params: {
    q: string
    category?: string
    verified_only?: boolean
    min_rating?: number
    lat?: number
    lng?: number
    limit?: number
    offset?: number
  }) => apiFetch('/search', { query: params }),

  /**
   * Get search suggestions (for dropdown)
   */
  suggestions: (params: {
    q: string
    limit?: number
  }) => apiFetch('/search/suggestions', { query: params }),

  /**
   * Get user's search history
   */
  getHistory: () => apiFetch('/search/history'),

  /**
   * Save search query to history
   */
  saveHistory: (query: string) => apiFetch('/search/history', {
    method: 'POST',
    body: { query },
  }),

  /**
   * Clear search history
   */
  clearHistory: () => apiFetch('/search/history', { method: 'DELETE' }),
}

// ──────────────────────────────────────────────────────────────
// Chat API
// ──────────────────────────────────────────────────────────────

export const storageApi = {
  /**
   * Get signed URL for uploading to R2
   */
  signUpload: (key: string, contentType: string) =>
    apiFetch('/storage/sign', {
      method: 'POST',
      body: { key, contentType },
    }),

  /**
   * Delete files from R2 (server-side)
   */
  deleteFiles: (keys: string[]) =>
    apiFetch('/storage/files', { method: 'DELETE', body: { keys } }),
}

export const reelApi = {
  /**
   * Get reels by vendor_id
   */
  getReels: (vendor_id: string, include_all?: boolean) =>
    apiFetch('/reels', { query: { vendor_id, include_all } }),

  /**
   * Create a reel
   */
  createReel: (data: {
    vendor_id: string
    video_url: string
    thumbnail_url: string
    caption?: string
    product_id?: string
  }) => apiFetch('/reels', { method: 'POST', body: data }),

  /**
   * Get a single reel
   */
  getReel: (reelId: string) => apiFetch(`/reels/${reelId}`),

  /**
   * Increment view count
   */
  incrementView: (reelId: string) => apiFetch(`/reels/${reelId}/view`, { method: 'POST' }),

  /**
   * Delete a reel
   */
  deleteReel: (reelId: string) => apiFetch(`/reels/${reelId}`, { method: 'DELETE' }),

  /**
   * Get saved reels for current user
   */
  getSavedReels: () => apiFetch('/reels/saved'),
}

export const walletApi = {
  /**
   * Get wallet balance
   */
  getBalance: () => apiFetch('/wallet/balance'),
}

export const chatApi = {
  /**
   * Get all conversations for current user
   */
  getConversations: () => apiFetch('/conversations'),

  /**
   * Get a specific conversation
   */
  getConversation: (id: string) => apiFetch(`/conversations/${id}`),

  /**
   * Create a new conversation (buyer only)
   */
  createConversation: (vendor_id: string) => apiFetch('/conversations', {
    method: 'POST',
    body: { vendor_id },
  }),

  /**
   * Get messages for a conversation
   */
  getMessages: (conversationId: string, params?: {
    limit?: number
    before?: string
  }) => apiFetch(`/conversations/${conversationId}/messages`, { query: params }),

  /**
   * Send a message
   */
  sendMessage: (data: {
    conversation_id: string
    content: string
    type?: 'text' | 'image' | 'payment_request'
    image_url?: string
    payment_request_id?: string
  }) => apiFetch('/messages', { method: 'POST', body: data }),

  /**
   * Mark messages as delivered/read
   */
  markDelivered: (conversationId: string) =>
    apiFetch(`/conversations/${conversationId}/mark-delivered`, { method: 'PATCH' }),

  /**
   * Reset unread count
   */
  resetUnread: (conversationId: string, field: 'buyer_unread' | 'vendor_unread') =>
    apiFetch(`/conversations/${conversationId}/reset-unread?field=${field}`, { method: 'PATCH' }),

  /**
   * Update user presence
   */
  setPresence: (is_online: boolean) => apiFetch('/presence', {
    method: 'POST',
    body: { is_online },
  }),

  /**
   * Get user presence (bulk)
   */
  getPresence: (userIds: string[]) => apiFetch(`/presence?user_ids=${userIds.join(',')}`),

  /**
   * Update a message
   */
  updateMessage: (messageId: string, content: string) =>
    apiFetch(`/messages/${messageId}`, {
      method: 'PATCH',
      body: { content },
    }),

  /**
   * Delete a message
   */
  deleteMessage: (messageId: string) =>
    apiFetch(`/messages/${messageId}`, { method: 'DELETE' }),

  /**
   * Create a payment request
   */
  createPaymentRequest: (conversationId: string, amount: number, description?: string) =>
    apiFetch(`/conversations/${conversationId}/payment-requests`, {
      method: 'POST',
      body: { conversation_id: conversationId, amount, description },
    }),

  /**
   * Pay a payment request
   */
  payPaymentRequest: (paymentRequestId: string) =>
    apiFetch(`/payment-requests/${paymentRequestId}/pay`, { method: 'POST' }),

  /**
   * Cancel a payment request
   */
  cancelPaymentRequest: (paymentRequestId: string) =>
    apiFetch(`/payment-requests/${paymentRequestId}`, { method: 'DELETE' }),
}

// ──────────────────────────────────────────────────────────────
// Saved Vendors API
// ──────────────────────────────────────────────────────────────

export const savedVendorApi = {
  /**
   * Get all saved vendors for current user
   */
  getSavedVendors: () => apiFetch('/saved-vendors'),

  /**
   * Save a vendor
   */
  saveVendor: (vendor_id: string) => apiFetch('/saved-vendors', {
    method: 'POST',
    body: { vendor_id },
  }),

  /**
   * Unsave a vendor
   */
  unsaveVendor: (vendorId: string) => apiFetch(`/saved-vendors/${vendorId}`, { method: 'DELETE' }),

  /**
   * Check if vendor is saved
   */
  checkSaved: (vendorId: string) => apiFetch(`/saved-vendors/${vendorId}/check`),
}

// ──────────────────────────────────────────────────────────────
// Reviews API
// ──────────────────────────────────────────────────────────────

export const reviewApi = {
  /**
   * Get reviews for a vendor (public)
   */
  getVendorReviews: (vendorId: string) => apiFetch('/reviews', { query: { vendor_id: vendorId } }),

  /**
   * Get reviews written by current user (with vendor details)
   */
  getMyReviews: () => apiFetch('/reviews/me'),

  /**
   * Create a review
   */
  createReview: (vendor_id: string, rating: number, comment?: string) => apiFetch('/reviews', {
    method: 'POST',
    body: { vendor_id, rating, comment },
  }),

  /**
   * Update a review
   */
  updateReview: (reviewId: string, rating: number, comment?: string) => apiFetch(`/reviews/${reviewId}`, {
    method: 'PATCH',
    body: { rating, comment },
  }),

  /**
   * Delete a review
   */
  deleteReview: (reviewId: string) => apiFetch(`/reviews/${reviewId}`, { method: 'DELETE' }),
}

// ──────────────────────────────────────────────────────────────
// User API
// ──────────────────────────────────────────────────────────────

export const userApi = {
  /**
   * Get current user profile
   */
  getProfile: () => apiFetch('/users/me'),
}

// ──────────────────────────────────────────────────────────────
// Orders API
// ──────────────────────────────────────────────────────────────

export const orderApi = {
  /**
   * Get orders for current user (bought or sold)
   */
  getOrders: (type?: 'bought' | 'sold') => apiFetch('/orders/me', { query: { type } }),

  /**
   * Get order statistics for current user
   */
  getStats: () => apiFetch('/orders/me/stats'),
}