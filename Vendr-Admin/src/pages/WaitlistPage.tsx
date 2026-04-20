import { useState } from 'react'
import { Search, RefreshCw, Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Table from '../components/Table'
import Badge from '../components/Badge'
import { useQuery } from '../hooks/useQuery'
import { adminApi } from '../lib/api'
import { formatDateTime } from '../lib/utils'

interface WaitlistEntry {
  id: string
  name: string | null
  email: string
  type: string | null
  created_at: string
}

export default function WaitlistPage() {
  const [search, setSearch] = useState('')

  // /admin/waitlist returns the array directly
  const { data, loading, refetch } = useQuery<WaitlistEntry[]>(
    () => adminApi.getWaitlist()
  )

  const allItems = Array.isArray(data) ? data : []

  const items = allItems.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.email.toLowerCase().includes(q) ||
      e.name?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q)
    )
  })

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Type', 'Joined'],
      ...items.map((e) => [e.name ?? '', e.email, e.type ?? '', formatDateTime(e.created_at)]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vendr-waitlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: WaitlistEntry) => (
        <p className="text-cream font-medium">{row.name ?? '—'}</p>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (row: WaitlistEntry) => (
        <p className="text-cream text-sm">{row.email}</p>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: WaitlistEntry) => row.type ? (
        <Badge variant={row.type === 'vendor' ? 'orange' : 'muted'}>
          {row.type}
        </Badge>
      ) : <span className="text-muted">—</span>,
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (row: WaitlistEntry) => (
        <p className="text-sm text-cream">{formatDateTime(row.created_at)}</p>
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Waitlist"
        subtitle={`${allItems.length} entries`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="btn-secondary">
              <RefreshCw size={14} />
              Refresh
            </button>
            <button onClick={exportCSV} className="btn-primary">
              <Download size={14} />
              Export CSV
            </button>
          </div>
        }
      />

      <div className="flex justify-end mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search waitlist..."
            className="input pl-9 w-64"
          />
        </div>
      </div>

      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="No waitlist entries"
        />
      </div>
    </div>
  )
}