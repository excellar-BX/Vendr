import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Overview from './pages/Dashboard'
import Verification from './pages/Verification'
import Users from './pages/Users'
import Vendors from './pages/Vendors'
import Orders from './pages/Orders'
import Disputes from './pages/Disputes'
import Waitlist from './pages/Waitlist'
import Transactions from './pages/Transactions'
import WalletTransactions from './pages/WalletTransactions'

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-dark">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/verification" element={<Verification />} />
              <Route path="/users" element={<Users />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/disputes" element={<Disputes />} />
              <Route path="/waitlist" element={<Waitlist />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/wallet-transactions" element={<WalletTransactions />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App
