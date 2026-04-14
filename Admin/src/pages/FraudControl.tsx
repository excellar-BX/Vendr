import { useEffect, useState } from 'react'
import { getVendors, toggleVendorFraudFlag, toggleVendorWithdrawal } from '../api'

interface Vendor {
  id: string
  shop_name: string
  is_fraud_flagged: boolean
  fraud_reason: string | null
  withdrawal_enabled: boolean
  withdrawal_cooldown_until: string | null
  user: {
    full_name: string
    email: string
  }
}

export default function FraudControl() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    try {
      const data = await getVendors()
      setVendors(data)
    } catch (error) {
      console.error('Error fetching vendors:', error)
      // Mock data for now
      setVendors([
        {
          id: '1',
          shop_name: 'Test Store',
          is_fraud_flagged: false,
          fraud_reason: null,
          withdrawal_enabled: true,
          withdrawal_cooldown_until: null,
          user: { full_name: 'John Doe', email: 'john@example.com' },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFraudFlag = async (vendorId: string, isFlagged: boolean) => {
    try {
      await toggleVendorFraudFlag(vendorId, isFlagged, isFlagged ? 'Manual admin flag' : null)
      fetchVendors()
    } catch (error) {
      console.error('Error toggling fraud flag:', error)
    }
  }

  const handleToggleWithdrawal = async (vendorId: string, enabled: boolean) => {
    try {
      await toggleVendorWithdrawal(vendorId, enabled)
      fetchVendors()
    } catch (error) {
      console.error('Error toggling withdrawal:', error)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Fraud Control</h1>
      <div className="space-y-4">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{vendor.shop_name}</h3>
                <p className="text-sm text-gray-400 mt-1">{vendor.user.full_name}</p>
                <p className="text-sm text-gray-400">{vendor.user.email}</p>
                {vendor.fraud_reason && (
                  <p className="text-sm text-red-400 mt-2">Reason: {vendor.fraud_reason}</p>
                )}
                {vendor.withdrawal_cooldown_until && (
                  <p className="text-sm text-yellow-400 mt-2">
                    Cooldown until: {new Date(vendor.withdrawal_cooldown_until).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs ${
                  vendor.is_fraud_flagged ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}>
                  {vendor.is_fraud_flagged ? 'Flagged' : 'Safe'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  vendor.withdrawal_enabled ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                }`}>
                  {vendor.withdrawal_enabled ? 'Withdrawals Enabled' : 'Withdrawals Disabled'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleToggleFraudFlag(vendor.id, !vendor.is_fraud_flagged)}
                className={`${
                  vendor.is_fraud_flagged ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                } text-white px-4 py-2 rounded-lg text-sm`}
              >
                {vendor.is_fraud_flagged ? 'Unflag' : 'Flag for Fraud'}
              </button>
              <button
                onClick={() => handleToggleWithdrawal(vendor.id, !vendor.withdrawal_enabled)}
                className={`${
                  vendor.withdrawal_enabled ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'
                } text-white px-4 py-2 rounded-lg text-sm`}
              >
                {vendor.withdrawal_enabled ? 'Disable Withdrawals' : 'Enable Withdrawals'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
