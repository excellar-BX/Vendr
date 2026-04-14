import { useEffect, useState } from 'react'

interface WaitlistEntry {
  id: string
  name: string | null
  email: string
  type: string | null
  created_at: string
}

export default function Waitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    try {
      // TODO: Replace with actual API call
      setEntries([
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          type: 'vendor',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          type: 'buyer',
          created_at: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.error('Error fetching waitlist:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Type', 'Joined Date']
    const rows = entries.map(entry => [
      entry.name || '',
      entry.email,
      entry.type || '',
      new Date(entry.created_at).toLocaleDateString()
    ])
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'waitlist.csv'
    a.click()
  }

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-cream">Waitlist</h1>
          <p className="text-sm text-muted mt-1">Total: {entries.length} signups</p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-orange text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-light"
        >
          Export CSV
        </button>
      </div>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Email</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Type</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Joined Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-cream">{entry.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-muted">{entry.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    entry.type === 'vendor' ? 'bg-orange text-cream' : 'bg-dark-4 text-muted'
                  }`}>
                    {entry.type || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
