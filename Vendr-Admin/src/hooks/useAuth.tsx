import React, { createContext, useContext, useState, useEffect } from 'react'
import { getAdminToken, setAdminToken, clearAdminToken, adminFetch } from '../lib/api'

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: string
}

interface AuthContextValue {
  user: AdminUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      setLoading(false)
      return
    }
    // Verify token is still valid by fetching current user
    adminFetch('/admin/me')
      .then((res) => {
        const data = res as { data: AdminUser }
        setUser(data.data)
      })
      .catch(() => {
        clearAdminToken()
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await adminFetch('/admin/login', {
      method: 'POST',
      body: { email, password },
    })
    const data = res as { data: { accessToken: string; user: AdminUser } }
    setAdminToken(data.data.accessToken)
    setUser(data.data.user)
  }

  const logout = () => {
    clearAdminToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}