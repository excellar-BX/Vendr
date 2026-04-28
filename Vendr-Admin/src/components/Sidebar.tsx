import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Store,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  AlertTriangle,
  Bell,
  LogOut,
  Flame,
  ListOrdered,
  Flag,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { initials } from '../lib/utils'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/vendors', icon: Store, label: 'Vendors' },
  { to: '/vendor-reports', icon: Flag, label: 'Vendor Reports' },
  { to: '/verifications', icon: ShieldCheck, label: 'Verifications' },
  { to: '/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/transactions', icon: CreditCard, label: 'Transactions' },
  { to: '/disputes', icon: AlertTriangle, label: 'Disputes' },
  { to: '/waitlist', icon: ListOrdered, label: 'Waitlist' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-dark-2 border-r border-dark-5">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dark-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center">
            <Flame size={16} className="text-cream" />
          </div>
          <div>
            <p className="text-sm font-bold text-cream leading-none">Vendr</p>
            <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} className="link-icon shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className="px-3 py-4 border-t border-dark-5">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange/20 border border-orange/30 flex items-center justify-center text-xs font-bold text-orange">
            {initials(user?.full_name ?? user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-cream truncate">
              {user?.full_name ?? 'Admin'}
            </p>
            <p className="text-[11px] text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-brand-red hover:text-brand-red hover:bg-brand-red/10"
        >
          <LogOut size={16} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}