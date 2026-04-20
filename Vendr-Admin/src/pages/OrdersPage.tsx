import { useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type Order } from '../lib/api'
import { formatCurrency, formatDateTime, timeAgo } from '../lib/utils'

type OrderFilter = 'all' | 'pending' | 'completed' | 'disputed' | 'cancelled'

export default function OrdersPage() {
  const [filter, setFilter] = useState<OrderFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  const { data, loading, refetch } = useQuery<{ items: Order[]; total: number }>(
    () => adminApi.getOrders({ limit: 100, status: filter === 'all' ? undefined : filter }),
    [filter]
  )

  const items = (data?.items ?? []).filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.id.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.buyer?.email?.toLowerCase().includes(q) ||
      o.vendor?.shop_name?.toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'id',
      label: 'Order',
      render: (row: Order) => (
        <div>
          <p className="font-mono text-xs text-orange">#{row.id.slice(0, 8)}</p>
          <p className="text-sm text-cream mt-0.5">{row.description ?? 'No description'}</p>
        </div>
      ),
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: (row: Order) => row.buyer ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.buyer.full_name ?? row.buyer.email} src={row.buyer.avatar_url} size="sm" />
          <span className="text-sm text-cream">{row.buyer.full_name ?? row.buyer.email}</span>
        </div>
      ) : <span className="text-muted">—</span>,
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (row: Order) => row.vendor ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.vendor.shop_name} src={row.vendor.logo_url} size="sm" />
          <span className="text-sm text-cream">{row.vendor.shop_name}</span>
        </div>
      ) : <span className="text-muted">—</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Order) => (
        <p className="font-semibold text-cream">{formatCurrency(row.amount)}</p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Order) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          <StatusBadge status={row.escrow_status} />
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row: Order) => (
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
        title="Orders"
        subtitle={`${data?.total ?? 0} total orders`}
        actions={
          <button onClick={refetch} className="btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-dark-2 border border-dark-5 rounded-xl p-1">
          {(['all', 'pending', 'completed', 'disputed', 'cancelled'] as OrderFilter[]).map((f) => (
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
            placeholder="Search orders..."
            className="input pl-9 w-64"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No orders found"
          onRowClick={(row) => setSelected(row as unknown as Order)}
        />
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="Order Details" size="md">
          <div className="space-y-4">
            <div className="p-4 bg-dark-3 rounded-xl border border-dark-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs text-orange">Order #{selected.id.slice(0, 8)}</p>
                <div className="flex gap-1.5">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.escrow_status} />
                </div>
              </div>
              <p className="text-2xl font-bold text-cream">{formatCurrency(selected.amount)}</p>
              {selected.description && <p className="text-sm text-muted mt-1">{selected.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                <p className="text-xs text-muted mb-2">Buyer</p>
                {selected.buyer ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={selected.buyer.full_name ?? selected.buyer.email} size="sm" />
                    <p className="text-sm text-cream truncate">{selected.buyer.full_name ?? selected.buyer.email}</p>
                  </div>
                ) : <p className="text-sm text-muted">—</p>}
              </div>
              <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
                <p className="text-xs text-muted mb-2">Vendor</p>
                {selected.vendor ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={selected.vendor.shop_name} size="sm" />
                    <p className="text-sm text-cream truncate">{selected.vendor.shop_name}</p>
                  </div>
                ) : <p className="text-sm text-muted">—</p>}
              </div>
            </div>

            <div className="p-3 bg-dark-3 rounded-lg border border-dark-5">
              <p className="text-xs text-muted mb-1">Created</p>
              <p className="text-sm text-cream">{formatDateTime(selected.created_at)}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}