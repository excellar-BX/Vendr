import { useState } from 'react'
import { ShieldCheck, ShieldX, Eye, Search, CheckCircle2, XCircle, Clock, Building2, CreditCard, MapPin, FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge, { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type VerificationRequest } from '../lib/api'
import { formatDate, timeAgo } from '../lib/utils'

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

export default function VerificationsPage() {
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<VerificationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ items: VerificationRequest[]; total: number }>(
    () => adminApi.getVerifications({ status: filter === 'all' ? undefined : filter, limit: 50 }),
    [filter]
  )

  const items = (data?.items ?? []).filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.vendor?.shop_name?.toLowerCase().includes(q) ||
      v.cac_number?.toLowerCase().includes(q) ||
      v.nin_number?.toLowerCase().includes(q)
    )
  })

  const filterCounts = {
    pending: data?.items.filter((v) => v.status === 'pending').length ?? 0,
    approved: data?.items.filter((v) => v.status === 'approved').length ?? 0,
    rejected: data?.items.filter((v) => v.status === 'rejected').length ?? 0,
  }

  const handleApprove = async (v: VerificationRequest) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.approveVerification(v.id)
      refetch()
      setSelected(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.rejectVerification(selected.id, rejectReason)
      refetch()
      setSelected(null)
      setRejectModalOpen(false)
      setRejectReason('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'vendor',
      label: 'Vendor',
      render: (row: VerificationRequest) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.vendor?.shop_name} src={row.vendor?.logo_url} size="sm" />
          <div>
            <p className="font-medium text-cream">{row.vendor?.shop_name ?? '—'}</p>
            <p className="text-xs text-muted">{row.vendor?.category ?? 'Uncategorised'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'cac_number',
      label: 'CAC No.',
      render: (row: VerificationRequest) => (
        <span className="font-mono text-xs text-cream/80">{row.cac_number ?? '—'}</span>
      ),
    },
    {
      key: 'nin_number',
      label: 'NIN',
      render: (row: VerificationRequest) => (
        <span className="font-mono text-xs text-cream/80">{row.nin_number ?? '—'}</span>
      ),
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (row: VerificationRequest) => (
        <div>
          <p className="text-cream">{formatDate(row.submitted_at)}</p>
          <p className="text-xs text-muted">{timeAgo(row.submitted_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: VerificationRequest) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: VerificationRequest) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(row) }}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Eye size={13} />
            Review
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleApprove(row) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 text-brand-greenLight rounded-lg text-xs font-medium hover:bg-brand-green/20 transition-colors"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelected(row); setRejectModalOpen(true) }}
                className="btn-danger py-1.5 px-3 text-xs"
              >
                <XCircle size={13} />
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Verifications"
        subtitle="Review and manage vendor verification requests"
      />

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-dark-4 text-cream shadow-sm'
                  : 'text-muted hover:text-cream'
              }`}
            >
              {f === 'pending' && <Clock size={13} />}
              {f === 'approved' && <ShieldCheck size={13} />}
              {f === 'rejected' && <ShieldX size={13} />}
              <span className="capitalize">{f}</span>
              {f !== 'all' && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  filter === f ? 'bg-orange/20 text-orange' : 'bg-dark-5 text-muted'
                }`}>
                  {filterCounts[f as keyof typeof filterCounts]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor, CAC, NIN..."
            className="input pl-9 w-72"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No verification requests found"
        />
      </div>

      {/* Detail modal */}
      {selected && !rejectModalOpen && (
        <Modal
          open={!!selected}
          onClose={() => setSelected(null)}
          title="Verification Request"
          size="lg"
        >
          <div className="space-y-5">
            {/* Vendor info */}
            <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
              <Avatar name={selected.vendor?.shop_name} src={selected.vendor?.logo_url} size="lg" />
              <div>
                <p className="text-base font-semibold text-cream">{selected.vendor?.shop_name}</p>
                <p className="text-sm text-muted">{selected.vendor?.category} · {selected.vendor?.city}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selected.status} />
                  {selected.vendor?.is_fraud_flagged && (
                    <Badge variant="red">Fraud Flagged</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={14} className="text-muted" />
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">CAC Number</p>
                </div>
                <p className="font-mono text-sm text-cream">{selected.cac_number ?? 'Not provided'}</p>
              </div>

              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={14} className="text-muted" />
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">NIN Number</p>
                </div>
                <p className="font-mono text-sm text-cream">{selected.nin_number ?? 'Not provided'}</p>
              </div>

              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5 col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className="text-muted" />
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Business Address</p>
                </div>
                <p className="text-sm text-cream">{selected.business_address ?? 'Not provided'}</p>
              </div>
            </div>

            {/* Documents */}
            {Object.keys(selected.documents ?? {}).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} className="text-muted" />
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Submitted Documents</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(selected.documents).map(([key, url]) => (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-dark-3 border border-dark-5 rounded-xl text-xs text-orange hover:border-orange/40 transition-colors"
                    >
                      <FileText size={20} className="mb-2 text-muted" />
                      <p className="capitalize">{key.replace(/_/g, ' ')}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {selected.status === 'rejected' && selected.rejection_reason && (
              <div className="p-4 bg-brand-red/5 border border-brand-red/20 rounded-xl">
                <p className="text-xs font-medium text-brand-red uppercase tracking-wider mb-1">Rejection Reason</p>
                <p className="text-sm text-cream/80">{selected.rejection_reason}</p>
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-brand-red/10 border border-brand-red/30 rounded-lg text-sm text-brand-red">
                {actionError}
              </div>
            )}

            {/* Actions */}
            {selected.status === 'pending' && (
              <div className="flex items-center gap-3 pt-2 border-t border-dark-5">
                <button
                  onClick={() => handleApprove(selected)}
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-green/10 border border-brand-green/30 text-brand-greenLight rounded-lg text-sm font-medium hover:bg-brand-green/20 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  Approve Verification
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  disabled={actionLoading}
                  className="flex-1 btn-danger justify-center py-2.5"
                >
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reject reason modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setRejectReason('') }}
        title="Reject Verification"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Provide a reason for rejecting{' '}
            <span className="text-cream font-medium">{selected?.vendor?.shop_name}</span>'s verification request.
            This will be visible to the vendor.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. CAC number could not be verified, please resubmit with a clearer document..."
            rows={4}
            className="input resize-none"
          />
          {actionError && (
            <p className="text-sm text-brand-red">{actionError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setRejectModalOpen(false); setRejectReason('') }}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
              className="btn-danger flex-1 justify-center disabled:opacity-50"
            >
              <XCircle size={15} />
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}