import { useState } from 'react'
import { Search, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge, { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type Transaction } from '../lib/api'
import { formatCurrency, formatDateTime, timeAgo } from '../lib/utils'

type TxFilter = 'all' | 'deposit' | 'withdrawal' | 'payment' | 'escrow_release'

export default function TransactionsPage() {
  const [filter, setFilter] = useState<TxFilter>('all')
  const [search, setSearch] = useState('')

  const { data, loading, refetch } = useQuery<{ transactions: Transaction[]; total: number }>(
    () => adminApi.getTransactions({ limit: 100, type: filter === 'all' ? undefined : filter }),
    [filter]
  )

  const items = (data?.transactions ?? []).filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.reference?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.user?.email?.toLowerCase().includes(q)
    )
  })

  const totalVolume = items.reduce((sum, t) => sum + t.amount, 0)

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: Transaction) => (
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            row.type === 'deposit' ? 'bg-brand-green/10' : 'bg-orange/10'
          }`}>
            {row.type === 'deposit'
              ? <ArrowDownLeft size={14} className="text-brand-greenLight" />
              : <ArrowUpRight size={14} className="text-orange" />
            }
          </div>
          <div>
            <p className="text-sm text-cream capitalize">{row.type.replace(/_/g, ' ')}</p>
            <p className="text-xs text-muted">{row.provider}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (row: Transaction) => row.user ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.user.full_name ?? row.user.email} src={row.user.avatar_url} size="sm" />
          <div>
            <p className="text-sm text-cream">{row.user.full_name ?? '—'}</p>
            <p className="text-xs text-muted">{row.user.email}</p>
          </div>
        </div>
      ) : <span className="text-muted text-sm">—</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Transaction) => (
        <p className={`font-semibold ${
          row.type === 'deposit' ? 'text-brand-greenLight' : 'text-cream'
        }`}>
          {row.type === 'deposit' ? '+' : '-'}{formatCurrency(row.amount)}
        </p>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row: Transaction) => (
        <p className="font-mono text-xs text-muted truncate max-w-[120px]">{row.reference ?? '—'}</p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Transaction) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row: Transaction) => (
        <div>
          <p className="text-sm text-cream">{formatDateTime(row.created_at)}</p>
          <p className="text-xs text-muted">{timeAgo(row.created_at)}</p>
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Transactions"
        subtitle={`${data?.total ?? 0} total transactions`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      {/* Volume summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Filtered Volume</p>
          <p className="text-xl font-bold text-cream">{formatCurrency(totalVolume)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Total Count</p>
          <p className="text-xl font-bold text-cream">{items.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Average</p>
          <p className="text-xl font-bold text-cream">
            {items.length > 0 ? formatCurrency(totalVolume / items.length) : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1 flex-wrap">
          {(['all', 'deposit', 'withdrawal', 'payment', 'escrow_release'] as TxFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f ? 'bg-dark-4 text-cream' : 'text-muted hover:text-cream'
              }`}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ref, email..."
            className="input pl-9 w-64"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No transactions found"
        />
      </div>
    </div>
  )
}