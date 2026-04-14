import { useEffect, useState } from 'react'
import { getTransactions } from '../api'

interface Transaction {
  id: string
  type: string
  amount: number
  status: string
  description: string
  created_at: string
  user: {
    full_name: string
  }
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchTransactions()
  }, [filter])

  const fetchTransactions = async () => {
    try {
      const data = await getTransactions(filter)
      setTransactions(data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      // Mock data for now
      setTransactions([
        {
          id: '1',
          type: 'payment_sent',
          amount: 5000,
          status: 'success',
          description: 'Payment to vendor',
          created_at: new Date().toISOString(),
          user: { full_name: 'John Doe' },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Transactions</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-dark-2 border border-faint text-cream px-4 py-2 rounded-lg"
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">ID</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">User</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Type</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Provider</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-muted">{tx.id}</td>
                <td className="px-6 py-4 text-sm text-cream">{tx.user.full_name}</td>
                <td className="px-6 py-4 text-sm text-muted">{tx.type}</td>
                <td className="px-6 py-4 text-sm text-cream">₦{tx.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    tx.status === 'success' ? 'bg-brand-green text-cream' :
                    tx.status === 'pending' ? 'bg-gold text-dark' :
                    'bg-brand-red text-cream'
                  }`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">{tx.provider || 'monnify'}</td>
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
