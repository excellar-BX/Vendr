import { Users, Store, CreditCard, ShoppingBag, ShieldCheck, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import StatCard from '../components/StatCard'
import PageHeader from '../components/PageHeader'
import { StatusBadge } from '../components/Badge'
import Avatar from '../components/Avatar'
import { useQuery } from '../hooks/useQuery'
import { adminApi, type DashboardStats, type VerificationRequest, type Order } from '../lib/api'
import { formatCurrency, formatDateTime, timeAgo } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: stats, loading: statsLoading } = useQuery<DashboardStats>(
    () => adminApi.getStats()
  )

  const { data: verificationsRaw } = useQuery<{ items: VerificationRequest[] }>(
    () => adminApi.getVerifications({ status: 'pending', limit: 5 })
  )

  const { data: ordersRaw } = useQuery<{ items: Order[] }>(
    () => adminApi.getOrders({ limit: 5 })
  )

  const pendingVerifications = verificationsRaw?.items ?? []
  const recentOrders = ordersRaw?.items ?? []

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back. Here's what's happening on Vendr."
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={statsLoading ? '—' : (stats?.users.total ?? 0).toLocaleString()}
          subtitle={`${stats?.users.new_this_week ?? 0} new this week`}
          icon={Users}
          accent="orange"
          trend={{ value: 'Growing steadily', positive: true }}
        />
        <StatCard
          title="Active Vendors"
          value={statsLoading ? '—' : (stats?.users.vendors ?? 0).toLocaleString()}
          subtitle="Registered vendor accounts"
          icon={Store}
          accent="gold"
        />
        <StatCard
          title="Transaction Volume"
          value={statsLoading ? '—' : formatCurrency(stats?.transactions.total_volume ?? 0)}
          subtitle={`${formatCurrency(stats?.transactions.today_volume ?? 0)} today`}
          icon={CreditCard}
          accent="green"
          trend={{ value: 'All time', positive: true }}
        />
        <StatCard
          title="Total Orders"
          value={statsLoading ? '—' : (stats?.orders.total ?? 0).toLocaleString()}
          subtitle={`${stats?.orders.pending ?? 0} pending`}
          icon={ShoppingBag}
          accent="orange"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
            <ShieldCheck size={18} className="text-gold" />
          </div>
          <div>
            <p className="text-xl font-bold text-cream">{stats?.verifications.pending ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Pending Verifications</p>
          </div>
          {(stats?.verifications.pending ?? 0) > 0 && (
            <div className="ml-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse block" />
            </div>
          )}
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center">
            <AlertTriangle size={18} className="text-brand-red" />
          </div>
          <div>
            <p className="text-xl font-bold text-cream">{stats?.orders.disputed ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Open Disputes</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange/10 border border-orange/20 flex items-center justify-center">
            <TrendingUp size={18} className="text-orange" />
          </div>
          <div>
            <p className="text-xl font-bold text-cream">{stats?.transactions.count ?? 0}</p>
            <p className="text-xs text-muted mt-0.5">Total Transactions</p>
          </div>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pending verifications */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-gold" />
              <h3 className="text-sm font-semibold text-cream">Pending Verifications</h3>
            </div>
            <button
              onClick={() => navigate('/verifications')}
              className="text-xs text-orange hover:text-orange-light transition-colors"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-dark-5">
            {pendingVerifications.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">
                No pending verifications
              </div>
            ) : (
              pendingVerifications.map((v) => (
                <div
                  key={v.id}
                  onClick={() => navigate('/verifications')}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-dark-3 cursor-pointer transition-colors"
                >
                  <Avatar name={v.vendor?.shop_name} src={v.vendor?.logo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream truncate">
                      {v.vendor?.shop_name ?? 'Unknown Vendor'}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {timeAgo(v.submitted_at)}
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-5">
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-orange" />
              <h3 className="text-sm font-semibold text-cream">Recent Orders</h3>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-orange hover:text-orange-light transition-colors"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-dark-5">
            {recentOrders.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">
                No orders yet
              </div>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-dark-3 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream truncate">
                      {order.description ?? `Order #${order.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{formatDateTime(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-cream">{formatCurrency(order.amount)}</p>
                    <div className="mt-1">
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}