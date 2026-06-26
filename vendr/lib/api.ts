import { useAuthStore } from '../stores/authStore'
import WebStorage from './secureStorage'


const BASE_URL = 'https://vendr-production.up.railway.app/api' //process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.80.28.15:3000/api"
console.log(BASE_URL)
// ─── Token storage ────────────────────────────────────────────────────────────

export async function getAccessToken() {
  return await WebStorage.getItemAsync('access_token')
}

export async function getRefreshToken() {
  return await WebStorage.getItemAsync('refresh_token')
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await WebStorage.setItemAsync('access_token', accessToken)
  await WebStorage.setItemAsync('refresh_token', refreshToken)
}

export async function clearTokens() {
  await WebStorage.deleteItemAsync('access_token')
  await WebStorage.deleteItemAsync('refresh_token')
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

  try {
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
    // Only update refresh token if it's different (backend issues new one when close to expiry)
    if (data.data.refreshToken !== refreshToken) {
      await saveTokens(data.data.accessToken, data.data.refreshToken)
    } else {
      // Just update access token if refresh token is the same
      await WebStorage.setItemAsync('access_token', data.data.accessToken)
    }
    return data.data.accessToken
  } catch (error) {
    console.error('Refresh token failed:', error)
    // Don't clear tokens on network error, just return null and let retry happen
    return null
  }
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
    'ngrok-skip-browser-warning': 'true',
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
  } else if (fetchOptions.body && typeof fetchOptions.body === 'object') {
    // Stringify body objects for JSON requests
    fetchOptions.body = JSON.stringify(fetchOptions.body)
  }

  const res = await fetch(url, { ...fetchOptions, headers })

// Token expired — try refresh once
if (res.status === 401 && retry) {
  // Only treat as expired session on protected routes, not auth routes
  const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/google')
  if (isAuthRoute) {
    const data = await res.json()
    throw { statusCode: 401, message: data.message ?? 'Invalid credentials' }
  }
  const newToken = await refreshAccessToken()
  if (newToken) {
    return apiFetch(path, options, false)
  }
  throw { statusCode: 401, message: 'Your session has expired. Please log in again.' }
}

  // Handle network errors with retry
  if (!res.ok && res.status >= 500 && retry) {
    // Server error - retry once
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
    return apiFetch(path, options, false)
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
    lat?: number
    lng?: number
    limit?: number
    offset?: number
  }) => {
    const query: any = { ...params };
    if (params?.ids?.length) {
      query.ids = params.ids.join(',');
    }
    // Ensure lat/lng are strings for URL params
    if (params?.lat != null) query.lat = String(params.lat);
    if (params?.lng != null) query.lng = String(params.lng);
    return apiFetch('/vendors', { query });
  },
}

export const productApi = {
  /**
   * Get products by vendor_id (only active by default)
   */
  getProducts: (vendor_id: string, include_all?: boolean) =>
    apiFetch('/products', { query: { vendor_id, include_all } }),
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
    max_distance?: number
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
   * Clear search history (or delete specific query if provided)
   */
  clearHistory: (query?: string) => apiFetch('/search/history', { method: 'DELETE', query: query ? { query } : {} }),
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
   * Get reels (feed or vendor-specific)
   * No params -> main feed
   * vendor_id -> reels for that vendor
   * Optional: include_all=true (vendor only, includes inactive)
   * Optional: limit, offset for pagination
   * Auth required for personalization (is_liked, is_saved)
   */
  getReels: (params?: {
    vendor_id?: string
    include_all?: boolean
    limit?: number
    offset?: number
  }) => apiFetch('/reels', { query: params }),

  /**
   * Create a reel
   */
  createReel: (data: {
    video_url: string
    thumbnail_url?: string | null
    caption?: string | null
    product_id?: string | null
  }) => apiFetch('/reels', { method: 'POST', body: data }),

  /**
   * Get a single reel (enriched with vendor/product and like/save status)
   */
  getReel: (reelId: string) => apiFetch(`/reels/${reelId}`),

  /**
   * Increment view count
   */
  incrementView: (reelId: string) => apiFetch(`/reels/${reelId}/view`, { method: 'POST' }),

  /**
   * Toggle like on a reel
   */
  toggleLike: (reelId: string) => apiFetch(`/reels/${reelId}/like`, { method: 'POST' }),

  /**
   * Toggle save on a reel
   */
  toggleSave: (reelId: string) => apiFetch(`/reels/${reelId}/save`, { method: 'POST' }),

  /**
   * Get saved reels for current user (authenticated)
   */
  getSavedReels: () => apiFetch('/reels/saved'),

  /**
   * Delete a reel
   */
  deleteReel: (reelId: string) => apiFetch(`/reels/${reelId}`, { method: 'DELETE' }),
}

export const walletApi = {
  /**
   * Get wallet balance
   */
  getBalance: () => apiFetch('/wallet/balance'),

  /**
   * Get or create virtual account
   */
  getOrCreateVirtualAccount: () => apiFetch('/wallet/virtual-account', {
    method: 'POST',
  }),

  /**
   * Get virtual account
   */
  getVirtualAccount: () => apiFetch('/wallet/virtual-account'),

  /**
   * Get transaction history
   */
  getTransactions: (params?: { limit?: number; offset?: number }) =>
    apiFetch('/wallet/transactions', { query: params }),

  /**
   * Get list of supported banks
   */
  getBanks: () => apiFetch('/wallet/banks'),

  /**
   * Validate bank account
   */
  validateAccount: (params: { account_number: string; bank_code: string }) =>
    apiFetch('/wallet/validate-account', { query: params }),

  /**
   * Withdraw to bank
   */
  withdraw: (params: {
    amount: number;
    bank_code: string;
    account_number: string;
    account_name: string;
  }) =>
    apiFetch('/wallet/withdraw', {
      method: 'POST',
      body: params,
    }),

  /**
   * Add bank account
   */
  addBankAccount: (params: {
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_code: string;
  }) =>
    apiFetch('/wallet/bank-accounts', {
      method: 'POST',
      body: params,
    }),

  /**
   * Get bank accounts
   */
  getBankAccounts: () => apiFetch('/wallet/bank-accounts'),

  /**
   * Delete bank account
   */
  deleteBankAccount: (id: string) =>
    apiFetch(`/wallet/bank-accounts/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Set default bank account
   */
  setDefaultBankAccount: (id: string) =>
    apiFetch(`/wallet/bank-accounts/${id}/default`, {
      method: 'PUT',
    }),

  /**
   * Process payment (transfer between wallets)
   */
  pay: (params: {
    vendor_id: string;
    amount: number;
    payment_request_id?: string;
    description?: string;
  }) =>
    apiFetch('/wallet/pay', {
      method: 'POST',
      body: params,
    }),
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
   * Get a single message by ID
   */
  getMessage: (messageId: string) => apiFetch(`/messages/${messageId}`),

  /**
   * Send a message
   */
  sendMessage: (data: {
    conversation_id: string
    content: string
    type?: 'text' | 'image' | 'payment_request'
    image_url?: string
    payment_request_id?: string | null
    reply_to_id?: string | null
  }) => apiFetch('/messages', { method: 'POST', body: data }),

  /**
   * Add reaction to a message
   */
  addReaction: (messageId: string, emoji: string) =>
    apiFetch(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: { emoji },
    }),

  /**
   * Remove reaction from a message
   */
  removeReaction: (messageId: string) =>
    apiFetch(`/messages/${messageId}/reactions`, { method: 'DELETE' }),

  /**
   * Mark messages as delivered/read
   */
  markDelivered: (conversationId: string) =>
    apiFetch(`/conversations/${conversationId}/mark-delivered`, { method: 'PATCH' }),

  /**
   * Mark messages as read
   */
  markAsRead: (conversationId: string) =>
    apiFetch(`/conversations/${conversationId}/mark-read`, { method: 'PATCH' }),

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
  payPaymentRequest: (
    paymentRequestId: string,
    options?: { order_type?: 'pickup' | 'delivery'; delivery_address?: string }
  ) =>
    apiFetch(`/payment-requests/${paymentRequestId}/pay`, {
      method: 'POST',
      body: options ?? {},
    }),

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
   * Get reviews received for vendor's store (for vendors)
   */
  getReviewsReceived: () => apiFetch('/reviews/received'),

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
// Notifications API
// ──────────────────────────────────────────────────────────────

export const notificationApi = {
  /**
   * Get all notifications for current user
   */
  getNotifications: (limit?: number) => apiFetch('/notifications', { query: { limit } }),

  /**
   * Get unread notification count
   */
  getUnreadCount: () => apiFetch('/notifications/unread-count'),

  /**
   * Mark a notification as read
   */
  markAsRead: (notificationId: string) =>
    apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),

  /**
   * Delete a notification
   */
  deleteNotification: (notificationId: string) =>
    apiFetch(`/notifications/${notificationId}`, { method: 'DELETE' }),

  /**
   * Register Expo push token
   */
  registerPushToken: (pushToken: string) =>
    apiFetch('/notifications/register-token', { method: 'POST', body: { pushToken } }),

  /**
   * Clear push token
   */
  clearPushToken: () => apiFetch('/notifications/clear-token', { method: 'DELETE' }),
}

// ──────────────────────────────────────────────────────────────
// Orders API
// ──────────────────────────────────────────────────────────────

export const orderApi = {
  getOrders: (type?: 'bought' | 'sold') => apiFetch('/orders/me', { query: { type } }),

  getStats: () => apiFetch('/orders/me/stats'),

  /** Vendor: update order status */
  updateStatus: (orderId: string, status: string) =>
    apiFetch(`/orders/${orderId}/status`, { method: 'PATCH', body: { status } }),

  /** Buyer: confirm order receipt */
  confirmReceipt: (orderId: string) =>
    apiFetch(`/orders/${orderId}/confirm`, { method: 'POST' }),

  /** Pickup: buyer confirms they received the order */
  confirmDelivery: (orderId: string) =>
    apiFetch(`/escrow/confirm-delivery/${orderId}`, { method: 'POST' }),

  /** Delivery: buyer views their handoff code */
  getDeliveryOtp: (orderId: string) =>
    apiFetch(`/escrow/delivery-otp/${orderId}`),

  /** Delivery: vendor enters code spoken by buyer */
  verifyDeliveryOtp: (orderId: string, code: string) =>
    apiFetch(`/escrow/verify-otp/${orderId}`, { method: 'POST', body: { code } }),
}

export const disputeApi = {
  create: (data: {
    order_id: string;
    reason: string;
    description?: string;
    evidence_urls?: string[];
  }) => apiFetch('/disputes', { method: 'POST', body: data }),
}

export const verificationApi = {
  /**
   * Submit verification request for a vendor
   */
  submitVerification: (data: {
    vendor_id: string;
    cac_number: string;
    nin_number: string;
    business_address: string;
    documents: Record<string, any>;
  }) => apiFetch('/verification/submit', { method: 'POST', body: data }),

  /**
   * Get verification status for a vendor
   */
  getStatus: (vendorId: string) => apiFetch(`/verification/status/${vendorId}`),

  /**
   * Get verification details by vendor ID
   */
  getByVendorId: (vendorId: string) => apiFetch(`/verification/vendor/${vendorId}`),
}

// ──────────────────────────────────────────────────────────────
// Analytics API
// ──────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * Record a profile view for a vendor (public endpoint)
   */
  recordProfileView: (vendorId: string) =>
    apiFetch(`/vendors/${vendorId}/analytics/profile-view`, { method: 'POST' }),

  /**
   * Record a product view (public endpoint)
   */
  recordProductView: (productId: string) =>
    apiFetch(`/products/${productId}/analytics/view`, { method: 'POST' }),

  /**
   * Record an inquiry (conversation started) - authenticated
   */
  recordInquiry: (vendorId: string) =>
    apiFetch(`/vendors/${vendorId}/analytics/inquiry`, { method: 'POST' }),

  /**
   * Record an order (payment completed) - authenticated
   */
  recordOrder: (data: {
    vendorId: string;
    productId: string;
    amount: number;
  }) =>
    apiFetch('/vendors/analytics/order', { method: 'POST', body: data }),
}