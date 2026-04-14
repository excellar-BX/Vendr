import { useEffect, useState } from 'react'
import { getDisputes, resolveDispute } from '../api'

interface Dispute {
  id: string
  reason: string
  status: string
  created_at: string
  order: {
    id: string
    amount: number
  }
  buyer: {
    full_name: string
  }
  vendor: {
    shop_name: string
  }
}

export default function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDisputes()
  }, [])

  const fetchDisputes = async () => {
    try {
      const data = await getDisputes()
      setDisputes(data)
    } catch (error) {
      console.error('Error fetching disputes:', error)
      // Mock data for now
      setDisputes([
        {
          id: '1',
          reason: 'Product not received',
          status: 'open',
          created_at: new Date().toISOString(),
          order: { id: '1', amount: 5000 },
          buyer: { full_name: 'John Doe' },
          vendor: { shop_name: 'Test Store' },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleResolveDispute = async (disputeId: string, resolution: 'refund_buyer' | 'release_vendor') => {
    try {
      await resolveDispute(disputeId, resolution)
      fetchDisputes()
    } catch (error) {
      console.error('Error resolving dispute:', error)
    }
  }

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6">Disputes</h1>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Buyer</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Vendor</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Reason</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Created</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {disputes.map((dispute) => (
              <tr key={dispute.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-muted">{dispute.order.id}</td>
                <td className="px-6 py-4 text-sm text-cream">{dispute.buyer.full_name}</td>
                <td className="px-6 py-4 text-sm text-cream">{dispute.vendor.shop_name}</td>
                <td className="px-6 py-4 text-sm text-muted">{dispute.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    dispute.status === 'open' ? 'bg-brand-red text-cream' :
                    dispute.status === 'resolved' ? 'bg-brand-green text-cream' :
                    'bg-gold text-dark'
                  }`}>
                    {dispute.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(dispute.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  {dispute.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveDispute(dispute.id, 'refund_buyer')}
                        className="bg-brand-red text-cream px-3 py-1 rounded text-xs"
                      >
                        Refund
                      </button>
                      <button
                        onClick={() => handleResolveDispute(dispute.id, 'release_vendor')}
                        className="bg-brand-green text-cream px-3 py-1 rounded text-xs"
                      >
                        Release
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
