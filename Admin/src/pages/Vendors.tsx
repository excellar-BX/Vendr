import { useEffect, useState } from 'react'
import { getVendors, toggleVendorFraudFlag } from '../api'

interface Vendor {
  id: string
  shop_name: string
  category: string
  city: string
  rating: number
  review_count: number
  plan: string
  is_fraud_flagged: boolean
  fraud_flag_reason: string | null
  is_active: boolean
  user: {
    full_name: string
    email: string
  }
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
          category: 'Food',
          city: 'Lagos',
          rating: 4.5,
          review_count: 25,
          plan: 'pro',
          is_fraud_flagged: false,
          fraud_flag_reason: null,
          is_active: true,
          user: { full_name: 'John Doe', email: 'john@example.com' },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = vendors.filter(vendor =>
    vendor.shop_name.toLowerCase().includes(search.toLowerCase()) ||
    vendor.city.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Vendors</h1>
        <input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-dark-2 border border-faint text-cream px-4 py-2 rounded-lg"
        />
      </div>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Shop Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Category</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">City</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Rating</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Plan</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Fraud Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {filteredVendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-dark-3">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm text-cream font-medium">{vendor.shop_name}</p>
                    <p className="text-xs text-muted">{vendor.user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted">{vendor.category}</td>
                <td className="px-6 py-4 text-sm text-muted">{vendor.city}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cream">{vendor.rating}</span>
                    <span className="text-xs text-muted">({vendor.review_count})</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    vendor.plan === 'pro' ? 'bg-gold text-dark' : 'bg-dark-4 text-muted'
                  }`}>
                    {vendor.plan}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    vendor.is_fraud_flagged ? 'bg-brand-red text-cream' : 'bg-brand-green text-cream'
                  }`}>
                    {vendor.is_fraud_flagged ? 'Flagged' : 'Safe'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleVendorFraudFlag(vendor.id, !vendor.is_fraud_flagged, vendor.is_fraud_flagged ? null : 'Manual admin flag')}
                      className={`text-sm px-3 py-1 rounded ${
                        vendor.is_fraud_flagged ? 'bg-brand-green text-cream' : 'bg-brand-red text-cream'
                      }`}
                    >
                      {vendor.is_fraud_flagged ? 'Unflag' : 'Flag'}
                    </button>
                    <button className="text-orange text-sm hover:underline">View Store</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
