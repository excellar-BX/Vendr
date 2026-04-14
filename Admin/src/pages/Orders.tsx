import { useEffect, useState } from 'react'

interface Order {
  id: string
  buyer_id: string
  vendor_id: string
  vendor_user_id: string
  amount: number
  status: string
  escrow_status: string
  created_at: string
  auto_release_at: string | null
  buyer: {
    full_name: string
  }
  vendor: {
    shop_name: string
  }
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchOrders()
  }, [filter])

  const fetchOrders = async () => {
    try {
      // TODO: Replace with actual API call
      setOrders([
        {
          id: '1',
          buyer_id: '1',
          vendor_id: '1',
          vendor_user_id: '2',
          amount: 5000,
          status: 'pending',
          escrow_status: 'held',
          created_at: new Date().toISOString(),
          auto_release_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          buyer: { full_name: 'John Doe' },
          vendor: { shop_name: 'Test Store' },
        },
      ])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'held') return order.escrow_status === 'held'
    if (filter === 'released') return order.escrow_status === 'released'
    if (filter === 'refunded') return order.escrow_status === 'refunded'
    return true
  })

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Orders & Escrow</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-dark-2 border border-faint text-cream px-4 py-2 rounded-lg"
        >
          <option value="all">All</option>
          <option value="held">Held</option>
          <option value="released">Released</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Buyer</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Vendor</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Escrow Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Auto Release</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-muted">{order.id}</td>
                <td className="px-6 py-4 text-sm text-cream">{order.buyer.full_name}</td>
                <td className="px-6 py-4 text-sm text-cream">{order.vendor.shop_name}</td>
                <td className="px-6 py-4 text-sm text-cream">₦{order.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.status === 'pending' ? 'bg-gold text-dark' :
                    order.status === 'completed' ? 'bg-brand-green text-cream' :
                    'bg-brand-red text-cream'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    order.escrow_status === 'held' ? 'bg-gold text-dark' :
                    order.escrow_status === 'released' ? 'bg-brand-green text-cream' :
                    'bg-brand-red text-cream'
                  }`}>
                    {order.escrow_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {order.auto_release_at ? new Date(order.auto_release_at).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {order.escrow_status === 'held' && (
                      <>
                        <button className="bg-brand-green text-cream px-3 py-1 rounded text-xs">Release</button>
                        <button className="bg-brand-red text-cream px-3 py-1 rounded text-xs">Cancel</button>
                      </>
                    )}
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
