import { useState } from 'react'
import { Search, Eye, Flag, ShieldOff, RefreshCw, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge, { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type Vendor } from '../lib/api'
import { formatDate } from '../lib/utils'

type VendorFilter = 'all' | 'active' | 'flagged' | 'suspended'

export default function VendorsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<VendorFilter>('all')
  const [selected, setSelected] = useState<Vendor | null>(null)
  const [flagReason, setFlagReason] = useState('')
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ vendors: Vendor[]; total: number }>(
    () => adminApi.getVendors({
      limit: 100,
      is_fraud_flagged: filter === 'flagged' ? true : undefined,
    }),
    [filter]
  )

  const items = (data?.vendors ?? []).filter((v) => {
    if (filter === 'active' && !v.is_active) return false
    if (filter === 'suspended' && v.is_active) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.shop_name.toLowerCase().includes(q) ||
      v.category?.toLowerCase().includes(q) ||
      v.city?.toLowerCase().includes(q)
    )
  })

  const handleFlag = async () => {
    if (!selected || !flagReason.trim()) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.flagVendor(selected.id, flagReason)
      refetch()
      setSelected(null)
      setFlagModalOpen(false)
      setFlagReason('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to flag vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnflag = async (v: Vendor) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.unflagVendor(v.id)
      refetch()
      setSelected(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to unflag vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSuspend = async (v: Vendor) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.suspendVendor(v.id)
      refetch()
      setSelected(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to suspend vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'vendor',
      label: 'Vendor',
      render: (row: Vendor) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.shop_name} src={row.logo_url} size="sm" />
          <div>
            <p className="font-medium text-cream">{row.shop_name}</p>
            <p className="text-xs text-muted">{row.category ?? 'Uncategorised'} · {row.city ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (row: Vendor) => (
        <div>
          <p className="text-cream font-medium">
            {row.rating > 0 ? `★ ${row.rating.toFixed(1)}` : '—'}
          </p>
          <p className="text-xs text-muted">{row.review_count} reviews</p>
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row: Vendor) => (
        <Badge variant={row.plan === 'pro' ? 'gold' : 'muted'}>{row.plan}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Vendor) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={row.is_active ? 'active' : 'suspended'} />
          {row.is_fraud_flagged && <Badge variant="red">Flagged</Badge>}
          {row.verification_tier && <Badge variant="green">{row.verification_tier}</Badge>}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (row: Vendor) => (
        <p className="text-sm text-cream">{formatDate(row.created_at)}</p>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Vendor) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(row) }}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Eye size={13} />
            View
          </button>
          {row.is_fraud_flagged ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleUnflag(row) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 text-brand-greenLight rounded-lg text-xs font-medium hover:bg-brand-green/20 transition-colors"
            >
              <ShieldOff size={13} />
              Unflag
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(row); setFlagModalOpen(true) }}
              className="btn-danger py-1.5 px-3 text-xs"
            >
              <Flag size={13} />
              Flag
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Vendors"
        subtitle={`${data?.total ?? 0} total vendors`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['all', 'active', 'flagged', 'suspended'] as VendorFilter[]).map((f) => (
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
            placeholder="Search vendors..."
            className="input pl-9 w-72"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No vendors found"
          onRowClick={(row) => setSelected(row as unknown as Vendor)}
        />
      </div>

      {/* Detail modal */}
      {selected && !flagModalOpen && (
        <Modal open={!!selected} onClose={() => { setSelected(null); setActionError(null) }} title="Vendor Details" size="lg">
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
              <Avatar name={selected.shop_name} src={selected.logo_url} size="lg" />
              <div className="flex-1">
                <p className="text-base font-semibold text-cream">{selected.shop_name}</p>
                <p className="text-sm text-muted">{selected.category} · {selected.city}</p>
                <p className="text-xs text-muted mt-1">{selected.address}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={selected.is_active ? 'active' : 'suspended'} />
                  {selected.is_fraud_flagged && <Badge variant="red">Fraud Flagged</Badge>}
                  <Badge variant={selected.plan === 'pro' ? 'gold' : 'muted'}>{selected.plan}</Badge>
                </div>
              </div>
            </div>

            {selected.description && (
              <p className="text-sm text-muted italic">"{selected.description}"</p>
            )}

            {selected.is_fraud_flagged && selected.fraud_flag_reason && (
              <div className="p-4 bg-brand-red/5 border border-brand-red/20 rounded-xl flex gap-3">
                <AlertTriangle size={16} className="text-brand-red shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-brand-red uppercase tracking-wider mb-1">Fraud Flag Reason</p>
                  <p className="text-sm text-cream/80">{selected.fraud_flag_reason}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                <p className="text-xs text-muted mb-1">Rating</p>
                <p className="text-cream font-medium">
                  {selected.rating > 0 ? `★ ${selected.rating.toFixed(1)}` : 'No ratings'}
                </p>
              </div>
              <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                <p className="text-xs text-muted mb-1">Reviews</p>
                <p className="text-cream font-medium">{selected.review_count}</p>
              </div>
              <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                <p className="text-xs text-muted mb-1">Verification</p>
                <p className="text-cream font-medium">{selected.verification_tier ?? 'None'}</p>
              </div>
            </div>

            {actionError && <p className="text-sm text-brand-red">{actionError}</p>}

            <div className="flex gap-3 pt-2 border-t border-dark-5">
              {selected.is_fraud_flagged ? (
                <button
                  onClick={() => handleUnflag(selected)}
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-green/10 border border-brand-green/30 text-brand-greenLight rounded-lg text-sm font-medium hover:bg-brand-green/20 transition-colors disabled:opacity-50"
                >
                  <ShieldOff size={15} />
                  Remove Flag
                </button>
              ) : (
                <button
                  onClick={() => setFlagModalOpen(true)}
                  disabled={actionLoading}
                  className="flex-1 btn-danger justify-center py-2.5 disabled:opacity-50"
                >
                  <Flag size={15} />
                  Flag for Fraud
                </button>
              )}
              {selected.is_active && (
                <button
                  onClick={() => handleSuspend(selected)}
                  disabled={actionLoading}
                  className="flex-1 btn-danger justify-center py-2.5 disabled:opacity-50"
                >
                  <ShieldOff size={15} />
                  Suspend Vendor
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Flag reason modal */}
      <Modal
        open={flagModalOpen}
        onClose={() => { setFlagModalOpen(false); setFlagReason('') }}
        title="Flag Vendor for Fraud"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Flag <span className="text-cream font-medium">{selected?.shop_name}</span> for suspicious or fraudulent activity.
          </p>
          <textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Describe the fraudulent activity..."
            rows={4}
            className="input resize-none"
          />
          {actionError && <p className="text-sm text-brand-red">{actionError}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setFlagModalOpen(false); setFlagReason('') }} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={handleFlag}
              disabled={actionLoading || !flagReason.trim()}
              className="btn-danger flex-1 justify-center disabled:opacity-50"
            >
              <Flag size={14} />
              Confirm Flag
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}