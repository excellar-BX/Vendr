import { useState } from 'react'
import { Search, RefreshCw, CheckCircle2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type Dispute } from '../lib/api'
import { formatDateTime, timeAgo } from '../lib/utils'

type DisputeFilter = 'all' | 'open' | 'resolved'

export default function DisputesPage() {
  const [filter, setFilter] = useState<DisputeFilter>('open')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [resolution, setResolution] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ disputes: Dispute[]; total: number }>(
    () => adminApi.getDisputes({ status: filter === 'all' ? undefined : filter, limit: 100 }),
    [filter]
  )

  const items = (data?.disputes ?? []).filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.reason.toLowerCase().includes(q) ||
      d.buyer?.email?.toLowerCase().includes(q) ||
      d.vendor?.shop_name?.toLowerCase().includes(q)
    )
  })

  const handleResolve = async () => {
    if (!selected || !resolution.trim()) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.resolveDispute(selected.id, resolution)
      refetch()
      setSelected(null)
      setResolution('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resolve dispute')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'reason',
      label: 'Reason',
      render: (row: Dispute) => (
        <div>
          <p className="font-medium text-cream">{row.reason}</p>
          <p className="text-xs text-muted mt-0.5 line-clamp-1">{row.description ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: (row: Dispute) => row.buyer ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.buyer.full_name ?? row.buyer.email} size="sm" />
          <span className="text-sm text-cream truncate">{row.buyer.full_name ?? row.buyer.email}</span>
        </div>
      ) : <span className="text-muted">—</span>,
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (row: Dispute) => row.vendor ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.vendor.shop_name} src={row.vendor.logo_url} size="sm" />
          <span className="text-sm text-cream truncate">{row.vendor.shop_name}</span>
        </div>
      ) : <span className="text-muted">—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Dispute) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Filed',
      render: (row: Dispute) => (
        <div>
          <p className="text-sm text-cream">{formatDateTime(row.created_at)}</p>
          <p className="text-xs text-muted">{timeAgo(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Dispute) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelected(row) }}
          className="btn-secondary py-1.5 px-3 text-xs"
        >
          {row.status === 'open' ? 'Resolve' : 'View'}
        </button>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Disputes"
        subtitle={`${data?.total ?? 0} disputes`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['all', 'open', 'resolved'] as DisputeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f ? 'bg-dark-4 text-cream' : 'text-muted hover:text-cream'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search disputes..."
            className="input pl-9 w-64"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No disputes found"
          onRowClick={(row) => setSelected(row as unknown as Dispute)}
        />
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => { setSelected(null); setResolution(''); setActionError(null) }} title="Dispute Details" size="md">
          <div className="space-y-5">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-dark-3 rounded-xl border border-dark-5">
                <p className="text-xs text-muted mb-2 uppercase tracking-wider">Buyer</p>
                {selected.buyer && (
                  <div className="flex items-center gap-2">
                    <Avatar name={selected.buyer.full_name ?? selected.buyer.email} size="sm" />
                    <p className="text-sm text-cream">{selected.buyer.full_name ?? selected.buyer.email}</p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-dark-3 rounded-xl border border-dark-5">
                <p className="text-xs text-muted mb-2 uppercase tracking-wider">Vendor</p>
                {selected.vendor && (
                  <div className="flex items-center gap-2">
                    <Avatar name={selected.vendor.shop_name} src={selected.vendor.logo_url} size="sm" />
                    <p className="text-sm text-cream">{selected.vendor.shop_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dispute info */}
            <div className="p-4 bg-dark-3 rounded-xl border border-dark-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-cream">{selected.reason}</p>
                <StatusBadge status={selected.status} />
              </div>
              {selected.description && (
                <p className="text-sm text-muted">{selected.description}</p>
              )}
              <p className="text-xs text-muted">Filed {timeAgo(selected.created_at)}</p>
            </div>

            {/* Resolution */}
            {selected.resolution && (
              <div className="p-4 bg-brand-green/5 border border-brand-green/20 rounded-xl">
                <p className="text-xs font-medium text-brand-greenLight uppercase tracking-wider mb-1">Resolution</p>
                <p className="text-sm text-cream/80">{selected.resolution}</p>
              </div>
            )}

            {actionError && <p className="text-sm text-brand-red">{actionError}</p>}

            {/* Resolve form */}
            {selected.status === 'open' && (
              <div className="space-y-3 pt-2 border-t border-dark-5">
                <p className="text-sm font-medium text-cream">Resolve this dispute</p>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describe how this dispute was resolved and what action was taken..."
                  rows={3}
                  className="input resize-none"
                />
                <button
                  onClick={handleResolve}
                  disabled={actionLoading || !resolution.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  Mark Resolved
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}