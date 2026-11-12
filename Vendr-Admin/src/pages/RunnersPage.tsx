import { useState } from 'react'
import { Bike, Search, CheckCircle2, Ban, RotateCcw, Clock, Eye, MapPin, Phone, Mail } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminFetch } from '../lib/api'
import { formatDate, timeAgo } from '../lib/utils'

type RunnerStatus = 'pending' | 'active' | 'suspended'

interface Runner {
  id: string
  user_id: string
  full_name: string
  phone: string
  email: string
  vehicle_type: string
  plate_number: string | null
  vehicle_color: string | null
  operating_address: string
  operating_radius_km: number
  available_days: string[]
  start_time: string
  end_time: string
  profile_photo_url: string | null
  vehicle_photo_url: string | null
  is_online: boolean
  rating: number
  total_deliveries: number
  status: RunnerStatus
  created_at: string
}

const STATUS_STYLE: Record<RunnerStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  active: 'bg-brand-green/10 text-brand-greenLight border-brand-green/30',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/30',
}

/** Approve new delivery runners, suspend or reinstate existing ones. */
export default function RunnersPage() {
  const [filter, setFilter] = useState<RunnerStatus | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Runner | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<Runner | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ runners: Runner[]; counts: Partial<Record<RunnerStatus, number>> }>(
    () => adminFetch('/admin/runners', { query: { status: filter === 'all' ? undefined : filter, search: search.trim() || undefined } }) as any,
    [filter, search]
  )

  const setStatus = async (runner: Runner, status: RunnerStatus, why?: string) => {
    setBusyId(runner.id)
    setError(null)
    try {
      await adminFetch(`/admin/runners/${runner.id}`, { method: 'PATCH', body: { status, reason: why } })
      refetch()
      setSelected(null)
      setSuspendTarget(null)
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const Actions = ({ row }: { row: Runner }) => (
    <div className="flex items-center gap-2 justify-end">
      <button onClick={(e) => { e.stopPropagation(); setSelected(row) }} className="btn-secondary py-1.5 px-3 text-xs">
        <Eye size={13} /> Review
      </button>
      {row.status !== 'active' && (
        <button
          disabled={busyId === row.id}
          onClick={(e) => { e.stopPropagation(); setStatus(row, 'active') }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 text-brand-greenLight rounded-lg text-xs font-medium hover:bg-brand-green/20 transition-colors disabled:opacity-50"
        >
          {row.status === 'suspended' ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
          {row.status === 'suspended' ? 'Reinstate' : 'Approve'}
        </button>
      )}
      {row.status !== 'suspended' && (
        <button
          disabled={busyId === row.id}
          onClick={(e) => { e.stopPropagation(); setSuspendTarget(row) }}
          className="btn-danger py-1.5 px-3 text-xs disabled:opacity-50"
        >
          <Ban size={13} /> {row.status === 'pending' ? 'Decline' : 'Suspend'}
        </button>
      )}
    </div>
  )

  const columns = [
    {
      key: 'runner',
      label: 'Runner',
      render: (row: Runner) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} src={row.profile_photo_url ?? undefined} size="sm" />
          <div>
            <p className="font-medium text-cream flex items-center gap-2">
              {row.full_name}
              {row.is_online && <span className="inline-block w-2 h-2 rounded-full bg-brand-greenLight" title="Online" />}
            </p>
            <p className="text-xs text-muted">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (row: Runner) => (
        <div>
          <p className="text-cream capitalize">{row.vehicle_type}</p>
          <p className="text-xs text-muted">{[row.vehicle_color, row.plate_number].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'area',
      label: 'Area',
      render: (row: Runner) => (
        <div className="max-w-[220px]">
          <p className="text-cream truncate" title={row.operating_address}>{row.operating_address}</p>
          <p className="text-xs text-muted">{row.operating_radius_km} km radius</p>
        </div>
      ),
    },
    {
      key: 'deliveries',
      label: 'Deliveries',
      render: (row: Runner) => <span className="text-cream">{row.total_deliveries}</span>,
    },
    {
      key: 'created_at',
      label: 'Applied',
      render: (row: Runner) => (
        <div>
          <p className="text-cream">{formatDate(row.created_at)}</p>
          <p className="text-xs text-muted">{timeAgo(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Runner) => (
        <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${STATUS_STYLE[row.status]}`}>{row.status}</span>
      ),
    },
    { key: 'actions', label: '', render: (row: Runner) => <Actions row={row} /> },
  ]

  const counts = data?.counts ?? {}

  return (
    <div className="p-8">
      <PageHeader title="Runners" subtitle="Approve delivery runners and manage their accounts" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['pending', 'active', 'suspended', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-dark-4 text-cream shadow-sm' : 'text-muted hover:text-cream'}`}
            >
              {f === 'pending' && <Clock size={13} />}
              {f === 'active' && <Bike size={13} />}
              {f === 'suspended' && <Ban size={13} />}
              <span className="capitalize">{f}</span>
              {f !== 'all' && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${filter === f ? 'bg-orange/20 text-orange' : 'bg-dark-5 text-muted'}`}>
                  {counts[f] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, area..." className="input pl-9 w-72" />
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">{error}</div>}

      <div className="card">
        <Table columns={columns} data={data?.runners ?? []} loading={loading} emptyMessage="No runners here" onRowClick={(r: Runner) => setSelected(r)} />
      </div>

      {selected && !suspendTarget && (
        <Modal open onClose={() => setSelected(null)} title="Runner application" size="lg">
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
              <Avatar name={selected.full_name} src={selected.profile_photo_url ?? undefined} size="lg" />
              <div className="flex-1">
                <p className="text-base font-semibold text-cream">{selected.full_name}</p>
                <p className="text-sm text-muted flex items-center gap-1.5"><Phone size={12} /> {selected.phone}</p>
                <p className="text-sm text-muted flex items-center gap-1.5"><Mail size={12} /> {selected.email}</p>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
                <p className="text-xs text-muted mb-1">Vehicle</p>
                <p className="text-cream capitalize">{selected.vehicle_type}</p>
                <p className="text-muted">{[selected.vehicle_color, selected.plate_number].filter(Boolean).join(' · ') || 'No plate given'}</p>
              </div>
              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
                <p className="text-xs text-muted mb-1">Availability</p>
                <p className="text-cream">{selected.available_days.join(', ') || '—'}</p>
                <p className="text-muted">{selected.start_time} – {selected.end_time}</p>
              </div>
              <div className="p-4 bg-dark-3 rounded-xl border border-dark-5 col-span-2">
                <p className="text-xs text-muted mb-1 flex items-center gap-1.5"><MapPin size={12} /> Operating area</p>
                <p className="text-cream">{selected.operating_address}</p>
                <p className="text-muted">{selected.operating_radius_km} km radius · {selected.total_deliveries} deliveries completed</p>
              </div>
            </div>

            {(selected.profile_photo_url || selected.vehicle_photo_url) && (
              <div className="grid grid-cols-2 gap-4">
                {[['Profile photo', selected.profile_photo_url], ['Vehicle photo', selected.vehicle_photo_url]].map(([label, url]) => (
                  <div key={label as string}>
                    <p className="text-xs text-muted mb-2">{label}</p>
                    {url
                      ? <a href={url as string} target="_blank" rel="noreferrer"><img src={url as string} alt={label as string} className="w-full h-48 object-cover rounded-xl border border-dark-5" /></a>
                      : <div className="w-full h-48 rounded-xl border border-dashed border-dark-5 flex items-center justify-center text-xs text-muted">Not provided</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Actions row={selected} />
            </div>
          </div>
        </Modal>
      )}

      {suspendTarget && (
        <Modal open onClose={() => { setSuspendTarget(null); setReason('') }} title={suspendTarget.status === 'pending' ? 'Decline application' : 'Suspend runner'}>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {suspendTarget.full_name} will be taken offline and told why. You can reinstate them later.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (sent to the runner)"
              rows={3}
              className="input w-full"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setSuspendTarget(null); setReason('') }} className="btn-secondary">Cancel</button>
              <button
                disabled={!reason.trim() || busyId === suspendTarget.id}
                onClick={() => setStatus(suspendTarget, 'suspended', reason)}
                className="btn-danger disabled:opacity-50"
              >
                {suspendTarget.status === 'pending' ? 'Decline' : 'Suspend'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
