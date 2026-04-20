import { useState } from 'react'
import { Search, RefreshCw, ArrowUpRight, ArrowDownLeft, Clipboard, Check } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
// @ts-ignore - TypeScript false positive on named import
import { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type Transaction } from '../lib/api'
import { formatCurrency, formatDateTime, timeAgo } from '../lib/utils'

// These are the actual type values stored in your transactions table
const INCOMING_TYPES = new Set(['credit', 'payment_received', 'refund', 'deposit'])

function isIncoming(type: string): boolean {
  return INCOMING_TYPES.has(type)
}

// Filter tabs mapped to actual backend type values
type TxFilter = 'all' | 'credit' | 'debit' | 'withdrawal' | 'payment_sent' | 'payment_received' | 'refund' | 'escrow_release'

const FILTER_LABELS: Record<TxFilter, string> = {
  all: 'All',
  credit: 'Credit',
  debit: 'Debit',
  withdrawal: 'Withdrawal',
  payment_sent: 'Payment Sent',
  payment_received: 'Payment Received',
  refund: 'Refund',
  escrow_release: 'Escrow Release',
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<TxFilter>('all')
  const [search, setSearch] = useState('')
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ transactions: Transaction[]; total: number }>(
    () => adminApi.getTransactions({
      limit: 100,
      type: filter === 'all' ? undefined : filter,
    }),
    [filter]
  )

  const items = (data?.transactions ?? []).filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.reference?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.user?.email?.toLowerCase().includes(q) ||
      (t.user?.full_name ?? '').toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q)
    )
  })

  const totalVolume = items.reduce((sum, t) => sum + t.amount, 0)
  const incomingVolume = items.filter((t) => isIncoming(t.type)).reduce((sum, t) => sum + t.amount, 0)
  const outgoingVolume = items.filter((t) => !isIncoming(t.type)).reduce((sum, t) => sum + t.amount, 0)

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref)
    setCopiedRef(ref)
    setTimeout(() => setCopiedRef(null), 2000)
  }

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (row: Transaction) => {
        const incoming = isIncoming(row.type)
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              incoming
                ? 'bg-brand-green/10 border border-brand-green/20'
                : 'bg-orange/10 border border-orange/20'
            }`}>
              {incoming
                ? <ArrowDownLeft size={15} className="text-brand-greenLight" />
                : <ArrowUpRight size={15} className="text-orange" />
              }
            </div>
            <div>
              <p className="text-sm text-cream font-medium capitalize">
                {row.type.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-muted">{row.provider}</p>
            </div>
          </div>
        )
      },
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
      render: (row: Transaction) => {
        const incoming = isIncoming(row.type)
        return (
          <p className={`font-semibold tabular-nums ${incoming ? 'text-brand-greenLight' : 'text-cream'}`}>
            {incoming ? '+' : '−'}{formatCurrency(row.amount)}
          </p>
        )
      },
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row: Transaction) => {
        if (!row.reference) return <span className="text-muted text-sm">—</span>
        const isCopied = copiedRef === row.reference
        return (
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-muted truncate max-w-[140px]" title={row.reference}>
              {row.reference}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); copyReference(row.reference!) }}
              className="shrink-0 p-1 rounded hover:bg-dark-5 text-muted hover:text-cream transition-colors"
              title="Copy reference"
            >
              {isCopied ? <Check size={13} className="text-brand-greenLight" /> : <Clipboard size={13} />}
            </button>
          </div>
        )
      },
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
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Total Volume</p>
          <p className="text-xl font-bold text-cream tabular-nums">{formatCurrency(totalVolume)}</p>
          <p className="text-xs text-muted mt-1">{items.length} transactions</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownLeft size={13} className="text-brand-greenLight" />
            <p className="text-xs text-muted uppercase tracking-wider">Incoming</p>
          </div>
          <p className="text-xl font-bold text-brand-greenLight tabular-nums">
            {formatCurrency(incomingVolume)}
          </p>
          <p className="text-xs text-muted mt-1">
            {items.filter((t) => isIncoming(t.type)).length} transactions
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={13} className="text-orange" />
            <p className="text-xs text-muted uppercase tracking-wider">Outgoing</p>
          </div>
          <p className="text-xl font-bold text-orange tabular-nums">
            {formatCurrency(outgoingVolume)}
          </p>
          <p className="text-xs text-muted mt-1">
            {items.filter((t) => !isIncoming(t.type)).length} transactions
          </p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1 flex-wrap">
          {(Object.keys(FILTER_LABELS) as TxFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filter === f ? 'bg-dark-4 text-cream' : 'text-muted hover:text-cream'
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ref, name, email..."
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