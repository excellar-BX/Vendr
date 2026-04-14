import { useEffect, useState } from 'react'

interface WalletTransaction {
  id: string
  vendor_id: string
  order_id: string | null
  amount: number
  tx_type: string
  status: string
  created_at: string
  vendor: {
    shop_name: string
  }
}

export default function WalletTransactions() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchTransactions()
  }, [filter])

  const fetchTransactions = async () => {
    try {
      // TODO: Replace with actual API call
      setTransactions([
        {
          id: '1',
          vendor_id: '1',
          order_id: '1',
          amount: 5000,
          tx_type: 'credit',
          status: 'success',
          created_at: new Date().toISOString(),
          vendor: { shop_name: 'Test Store' },
        },
      ])
    } catch (error) {
      console.error('Error fetching wallet transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true
    return tx.tx_type === filter
  })

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Wallet Transactions</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-dark-2 border border-faint text-cream px-4 py-2 rounded-lg"
        >
          <option value="all">All</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
      </div>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Vendor</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Type</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {filteredTransactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-cream">{tx.vendor.shop_name}</td>
                <td className="px-6 py-4 text-sm text-muted">{tx.order_id || '-'}</td>
                <td className="px-6 py-4 text-sm text-cream">₦{tx.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    tx.tx_type === 'credit' ? 'bg-brand-green text-cream' :
                    tx.tx_type === 'debit' ? 'bg-brand-red text-cream' :
                    'bg-gold text-dark'
                  }`}>
                    {tx.tx_type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    tx.status === 'success' ? 'bg-brand-green text-cream' :
                    tx.status === 'pending' ? 'bg-gold text-dark' :
                    'bg-brand-red text-cream'
                  }`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(tx.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
