export default function Header() {
  return (
    <header className="bg-dark-2 border-b border-faint px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-cream">Admin Dashboard</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">Welcome, Admin</span>
          <button className="bg-orange text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-light transition-colors">
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
