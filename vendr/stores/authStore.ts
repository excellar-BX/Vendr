import { create } from 'zustand'

export type FontSize = 'Small' | 'Normal' | 'Large'

const fontScaleMap: Record<FontSize, number> = {
  Small: 0.88,
  Normal: 1.0,
  Large: 1.14,
}

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  is_verified: boolean
  is_vendor_verified: boolean
  is_deleted?: boolean
  notifications_enabled?: boolean
  location_enabled?: boolean
  created_at: string
  vendor: {
    id: string
    shop_name: string
    is_active: boolean
  } | null
}

interface AuthState {
  user: AuthUser | null
  isVendor: boolean
  isBuyer: boolean
  fontScale: number
  setUser: (user: AuthUser | null) => void
  setFontSize: (size: FontSize) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isVendor: false,
  isBuyer: true,
  fontScale: 1.0,

  setUser: (user) =>
    set({
      user,
      isVendor: !!user?.vendor,
      isBuyer: !user?.vendor,
    }),

  setFontSize: (size) => set({ fontScale: fontScaleMap[size] }),

  clear: () => set({ user: null, isVendor: false, isBuyer: true }),
}))