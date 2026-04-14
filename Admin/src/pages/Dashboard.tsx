import { useEffect, useState } from 'react'
import { getDashboardStats } from '../api'

interface DashboardStats {
  totalUsers: number
  totalVendors: number
  totalWaitlist: number
  totalOrders: number
  totalWalletBalance: number
  activeDisputes: number
}

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalVendors: 0,
    totalWaitlist: 0,
    totalOrders: 0,
    totalWalletBalance: 0,
    activeDisputes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const data = await getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Mock data for now
      setStats({
        totalUsers: 450,
        totalVendors: 85,
        totalWaitlist: 1200,
        totalOrders: 1250,
        totalWalletBalance: 2500000,
        activeDisputes: 12,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-cream">Loading...</div>
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '�' },
    { label: 'Total Vendors', value: stats.totalVendors, icon: '🏪' },
    { label: 'Waitlist Signups', value: stats.totalWaitlist, icon: '📝' },
    { label: 'Total Orders', value: stats.totalOrders, icon: '📦' },
    { label: 'Wallet Balance', value: `₦${(stats.totalWalletBalance / 1000000).toFixed(1)}M`, icon: '💰' },
    { label: 'Active Disputes', value: stats.activeDisputes, icon: '⚖️' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-dark-2 border border-faint rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{card.label}</p>
                <p className="text-3xl font-bold text-cream mt-2">{card.value}</p>
              </div>
              <span className="text-4xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
