import { useState } from 'react'
import { Search, Eye, Trash2, UserCheck, UserX, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge, { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type User } from '../lib/api'
import { formatDate, timeAgo } from '../lib/utils'

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'vendor' | 'admin'>('all')
  const [selected, setSelected] = useState<User | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data, loading, refetch } = useQuery<{ users: User[]; total: number }>(
    () => adminApi.getUsers({ limit: 100, search: search || undefined, role: roleFilter === 'all' ? undefined : roleFilter }),
    [roleFilter]
  )

  const items = (data?.users ?? []).filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    )
  })

  const handleDeleteUser = async () => {
    if (!selected) return
    setActionLoading(true)
    setActionError(null)
    try {
      await adminApi.deleteUser(selected.id)
      refetch()
      setSelected(null)
      setConfirmDelete(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (row: User) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name ?? row.email} src={row.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-cream">{row.full_name ?? '—'}</p>
            <p className="text-xs text-muted">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      label: 'Roles',
      render: (row: User) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.is_buyer && <Badge variant="muted">Buyer</Badge>}
          {row.is_vendor && <Badge variant="orange">Vendor</Badge>}
          {row.role === 'admin' && <Badge variant="gold">Admin</Badge>}
        </div>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      render: (row: User) => (
        <Badge variant={row.plan === 'pro' ? 'gold' : 'muted'}>
          {row.plan}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: User) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.is_deleted ? 'deleted' : row.is_verified ? 'verified' : 'unverified'} />
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (row: User) => (
        <div>
          <p className="text-cream text-sm">{formatDate(row.created_at)}</p>
          <p className="text-xs text-muted">{timeAgo(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: User) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(row); setConfirmDelete(false) }}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Eye size={13} />
            View
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        subtitle={`${data?.total ?? 0} total users`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['all', 'buyer', 'vendor', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                roleFilter === r ? 'bg-dark-4 text-cream' : 'text-muted hover:text-cream'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="input pl-9 w-72"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No users found"
          onRowClick={(row) => setSelected(row as unknown as User)}
        />
      </div>

      {/* User detail modal */}
      {selected && (
        <Modal
          open={!!selected}
          onClose={() => { setSelected(null); setConfirmDelete(false); setActionError(null) }}
          title="User Details"
          size="md"
        >
          {confirmDelete ? (
            <div className="space-y-4">
              <div className="p-4 bg-brand-red/5 border border-brand-red/20 rounded-xl">
                <p className="text-sm text-cream">
                  Are you sure you want to soft-delete{' '}
                  <span className="font-semibold text-brand-red">{selected.full_name ?? selected.email}</span>?
                  Their account will be marked as deleted but data will be retained.
                </p>
              </div>
              {actionError && <p className="text-sm text-brand-red">{actionError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="btn-danger flex-1 justify-center disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Profile */}
              <div className="flex items-center gap-4 p-4 bg-dark-3 rounded-xl border border-dark-5">
                <Avatar name={selected.full_name ?? selected.email} src={selected.avatar_url} size="lg" />
                <div className="flex-1">
                  <p className="text-base font-semibold text-cream">{selected.full_name ?? '—'}</p>
                  <p className="text-sm text-muted">{selected.email}</p>
                  {selected.phone && <p className="text-sm text-muted">{selected.phone}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selected.is_buyer && <Badge variant="muted">Buyer</Badge>}
                    {selected.is_vendor && <Badge variant="orange">Vendor</Badge>}
                    {selected.role === 'admin' && <Badge variant="gold">Admin</Badge>}
                    <StatusBadge status={selected.is_deleted ? 'deleted' : selected.is_verified ? 'verified' : 'unverified'} />
                    <Badge variant={selected.plan === 'pro' ? 'gold' : 'muted'}>{selected.plan}</Badge>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                  <p className="text-xs text-muted mb-1">User ID</p>
                  <p className="font-mono text-xs text-cream truncate">{selected.id}</p>
                </div>
                <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                  <p className="text-xs text-muted mb-1">Joined</p>
                  <p className="text-cream">{formatDate(selected.created_at)}</p>
                </div>
                <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                  <p className="text-xs text-muted mb-1">Google Account</p>
                  <p className="text-cream">{selected.google_id ? 'Linked' : 'Not linked'}</p>
                </div>
                <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                  <p className="text-xs text-muted mb-1">Notifications</p>
                  <p className="text-cream">{selected.notifications_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              {actionError && (
                <p className="text-sm text-brand-red">{actionError}</p>
              )}

              {/* Actions */}
              {!selected.is_deleted && (
                <div className="flex gap-3 pt-2 border-t border-dark-5">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="btn-danger flex-1 justify-center"
                  >
                    <Trash2 size={14} />
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}