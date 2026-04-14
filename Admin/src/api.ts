import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Dashboard Stats
export const getDashboardStats = async () => {
  const response = await api.get('/admin/stats')
  return response.data
}

// Transactions
export const getTransactions = async (filter?: string) => {
  const response = await api.get('/admin/transactions', { params: { filter } })
  return response.data
}

// Disputes
export const getDisputes = async () => {
  const response = await api.get('/admin/disputes')
  return response.data
}

export const resolveDispute = async (disputeId: string, resolution: 'refund_buyer' | 'release_vendor', adminNotes?: string) => {
  const response = await api.post(`/admin/disputes/${disputeId}/resolve`, { resolution, admin_notes: adminNotes })
  return response.data
}

// Verification Requests
export const getVerificationRequests = async () => {
  const response = await api.get('/admin/verification-requests')
  return response.data
}

export const approveVerificationRequest = async (requestId: string) => {
  const response = await api.post(`/admin/verification-requests/${requestId}/approve`)
  return response.data
}

export const rejectVerificationRequest = async (requestId: string, reason?: string) => {
  const response = await api.post(`/admin/verification-requests/${requestId}/reject`, { reason })
  return response.data
}

// Vendors (for fraud control)
export const getVendors = async () => {
  const response = await api.get('/admin/vendors')
  return response.data
}

export const toggleVendorFraudFlag = async (vendorId: string, isFraudFlagged: boolean, fraudReason?: string) => {
  const response = await api.patch(`/admin/vendors/${vendorId}/fraud-flag`, {
    is_fraud_flagged: isFraudFlagged,
    fraud_reason: fraudReason,
  })
  return response.data
}

export const toggleVendorWithdrawal = async (vendorId: string, withdrawalEnabled: boolean) => {
  const response = await api.patch(`/admin/vendors/${vendorId}/withdrawal`, {
    withdrawal_enabled: withdrawalEnabled,
  })
  return response.data
}

export default api
