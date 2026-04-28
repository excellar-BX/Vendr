import { useState } from 'react'
import { Search, Flag, ShieldOff, CheckCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type VendorReport } from '../lib/api'
import { formatDate } from '../lib/utils'

type ReportFilter = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'

const reasonLabels: Record<string, string> = {
  fraud: 'Fraud or scam',
  fake_products: 'Fake or misleading products',
  inappropriate_content: 'Inappropriate content',
  harassment: 'Harassment or abuse',
  other: 'Other',
}

const statusColors: Record<string, any> = {
  pending: 'red',
  reviewed: 'yellow',
  resolved: 'green',
  dismissed: 'muted',
}

export default function ReportedVendorsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ReportFilter>('all')
  const [selected, setSelected] = useState<VendorReport | null>(null)
  const [status, setStatus] = useState<'pending' | 'reviewed' | 'resolved' | 'dismissed'>('pending')
  const [adminNotes, setAdminNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ reports: VendorReport[]; total: number }>(
    () => adminApi.getVendorReports({
      limit: 100,
      status: filter === 'all' ? undefined : filter,
    }),
    [filter]
  )

  const items = (data?.reports ?? []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.vendor?.shop_name.toLowerCase().includes(q) ||
      r.user?.full_name?.toLowerCase().includes(q) ||
      r.user?.email?.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    )
  })

  const handleUpdateStatus = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.updateVendorReport(selected.id, { status, admin_notes: adminNotes.trim() || undefined })
      refetch()
      setSelected(null)
      setStatus('pending')
      setAdminNotes('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update report')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFlagVendor = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.flagVendor(selected.vendor_id, 'Flagged based on buyer report')
      refetch()
      setSelected(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to flag vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSuspendVendor = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.suspendVendor(selected.vendor_id)
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
      key: 'reporter',
      label: 'Reporter',
      render: (row: VendorReport) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.user?.full_name || 'User'} src={row.user?.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-cream">{row.user?.full_name || 'Anonymous'}</p>
            <p className="text-xs text-muted">{row.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (row: VendorReport) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.vendor?.shop_name || 'Vendor'} src={row.vendor?.logo_url} size="sm" />
          <div>
            <p className="font-medium text-cream">{row.vendor?.shop_name}</p>
            <p className="text-xs text-muted">{row.vendor?.category ?? 'Uncategorised'} · {row.vendor?.city ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row: VendorReport) => (
        <div>
          <p className="text-cream font-medium">{reasonLabels[row.reason] || row.reason}</p>
          {row.description && (
            <p className="text-xs text-muted mt-1 line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: VendorReport) => (
        <Badge variant={statusColors[row.status] || 'muted'}>{row.status}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Reported',
      render: (row: VendorReport) => (
        <p className="text-sm text-cream">{formatDate(row.created_at)}</p>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: VendorReport) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(row) }}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Flag size={13} />
            Review
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Vendor Reports"
        subtitle={`${data?.total ?? 0} total reports`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <Search size={14} />
            Refresh
          </button>
        }
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['all', 'pending', 'reviewed', 'resolved', 'dismissed'] as ReportFilter[]).map((f) => (
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
            placeholder="Search reports..."
            className="input pl-9 w-72"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No reports found"
          onRowClick={(row) => setSelected(row as unknown as VendorReport)}
        />
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => { setSelected(null); setActionError(null) }} title="Report Details" size="lg">
          <div className="space-y-5">
            {/* Reporter info */}
            <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
              <Avatar name={selected.user?.full_name || 'User'} src={selected.user?.avatar_url} size="lg" />
              <div className="flex-1">
                <p className="text-base font-semibold text-cream">Reported by</p>
                <p className="text-sm text-muted">{selected.user?.full_name || 'Anonymous'}</p>
                <p className="text-xs text-muted">{selected.user?.email}</p>
                <p className="text-xs text-muted mt-1">{selected.user?.phone}</p>
              </div>
            </div>

            {/* Vendor info */}
            <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
              <Avatar name={selected.vendor?.shop_name || 'Vendor'} src={selected.vendor?.logo_url} size="lg" />
              <div className="flex-1">
                <p className="text-base font-semibold text-cream">Reported Vendor</p>
                <p className="text-sm text-muted">{selected.vendor?.shop_name}</p>
                <p className="text-xs text-muted">{selected.vendor?.category} · {selected.vendor?.city}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selected.vendor?.is_suspended && <Badge variant="red">Suspended</Badge>}
                  {selected.vendor?.is_fraud_flagged && <Badge variant="red">Fraud Flagged</Badge>}
                  {selected.vendor?.user?.is_vendor_verified && <Badge variant="green">Verified</Badge>}
                </div>
              </div>
            </div>

            {/* Report details */}
            <div className="p-4 bg-brand-orange/5 border border-brand-orange/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Flag size={16} className="text-brand-orange" />
                <p className="text-sm font-medium text-brand-orange uppercase tracking-wider">Report Details</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted mb-1">Reason</p>
                  <p className="text-sm text-cream font-medium">{reasonLabels[selected.reason] || selected.reason}</p>
                </div>
                {selected.description && (
                  <div>
                    <p className="text-xs text-muted mb-1">Description</p>
                    <p className="text-sm text-cream/80">{selected.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p className="text-xs text-muted mb-1">Status</p>
                    <Badge variant={statusColors[selected.status] || 'muted'}>{selected.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Reported</p>
                    <p className="text-sm text-cream">{formatDate(selected.created_at)}</p>
                  </div>
                  {selected.reviewed_at && (
                    <div>
                      <p className="text-xs text-muted mb-1">Reviewed</p>
                      <p className="text-sm text-cream">{formatDate(selected.reviewed_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Existing admin notes */}
            {selected.admin_notes && (
              <div className="p-4 bg-dark-3 border border-dark-5 rounded-xl">
                <p className="text-xs text-muted mb-2">Admin Notes</p>
                <p className="text-sm text-cream/80">{selected.admin_notes}</p>
              </div>
            )}

            {/* Update status form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cream mb-2">Update Status</label>
                <div className="flex gap-2">
                  {(['pending', 'reviewed', 'resolved', 'dismissed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize border transition-all ${
                        status === s
                          ? 'bg-brand-orange border-brand-orange text-white'
                          : 'bg-dark-3 border-dark-5 text-muted hover:text-cream'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-cream mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this report..."
                  rows={3}
                  className="input resize-none"
                />
              </div>
            </div>

            {actionError && <p className="text-sm text-brand-red">{actionError}</p>}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t border-dark-5">
              <button
                onClick={handleUpdateStatus}
                disabled={actionLoading}
                className="flex-1 btn-primary justify-center py-2.5 disabled:opacity-50"
              >
                <CheckCircle size={15} />
                Update Status
              </button>
              <button
                onClick={handleFlagVendor}
                disabled={actionLoading || selected.vendor?.is_fraud_flagged}
                className="flex-1 btn-danger justify-center py-2.5 disabled:opacity-50"
              >
                <Flag size={15} />
                Flag Vendor
              </button>
              <button
                onClick={handleSuspendVendor}
                disabled={actionLoading || selected.vendor?.is_suspended}
                className="flex-1 btn-danger justify-center py-2.5 disabled:opacity-50"
              >
                <ShieldOff size={15} />
                Suspend Vendor
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
