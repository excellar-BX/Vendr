import { useEffect, useState } from 'react'

interface User {
  id: string
  full_name: string
  email: string
  role: string
  plan: string
  is_verified: boolean
  is_vendor_verified: boolean
  created_at: string
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // TODO: Replace with actual API call
      setUsers([
        {
          id: '1',
          full_name: 'John Doe',
          email: 'john@example.com',
          role: 'buyer',
          plan: 'free',
          is_verified: true,
          is_vendor_verified: false,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          full_name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'vendor',
          plan: 'pro',
          is_verified: true,
          is_vendor_verified: true,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Users</h1>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-dark-2 border border-faint text-cream px-4 py-2 rounded-lg"
        />
      </div>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Email</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Plan</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Email Verified</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Vendor Verified</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Created</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-cream">{user.full_name}</td>
                <td className="px-6 py-4 text-sm text-muted">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.role === 'vendor' ? 'bg-orange text-cream' : 'bg-dark-4 text-muted'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.plan === 'pro' ? 'bg-gold text-dark' : 'bg-dark-4 text-muted'
                  }`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.is_verified ? 'bg-brand-green text-cream' : 'bg-dark-4 text-muted'
                  }`}>
                    {user.is_verified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.is_vendor_verified ? 'bg-brand-green text-cream' : 'bg-dark-4 text-muted'
                  }`}>
                    {user.is_vendor_verified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="text-orange text-sm hover:underline">View Profile</button>
                    <button className="text-brand-red text-sm hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
