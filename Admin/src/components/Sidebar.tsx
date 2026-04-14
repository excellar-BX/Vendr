import { Link, useLocation } from 'react-router-dom'

const menuItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/verification', label: 'Vendor Verification', icon: '✅' },
  { path: '/users', label: 'Users', icon: '👥' },
  { path: '/vendors', label: 'Vendors', icon: '🏪' },
  { path: '/orders', label: 'Orders & Escrow', icon: '�' },
  { path: '/disputes', label: 'Disputes', icon: '⚖️' },
  { path: '/waitlist', label: 'Waitlist', icon: '📝' },
  { path: '/transactions', label: 'Transactions', icon: '💳' },
  { path: '/wallet-transactions', label: 'Wallet Transactions', icon: '�' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-dark-2 text-cream flex flex-col border-r border-faint">
      <div className="p-6 border-b border-faint">
        <h1 className="text-2xl font-bold text-orange">Vendr Admin</h1>
        <p className="text-sm text-muted mt-1">Dashboard</p>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-dark-3 text-orange border-l-4 border-orange'
                      : 'text-muted hover:bg-dark-3 hover:text-cream'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-faint">
        <p className="text-xs text-subtle">© 2024 Vendr</p>
      </div>
    </aside>
  )
}
