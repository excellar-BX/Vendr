import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  is_runner?: boolean
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
  isRunner: boolean
  isRunnerMode: boolean
  fontScale: number
  justLoggedOut: boolean
  setUser: (user: AuthUser | null) => void
  setFontSize: (size: FontSize) => void
  setRunnerMode: (active: boolean) => void
  clear: () => void
  setJustLoggedOut: (flag: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isVendor: false,
      isBuyer: true,
      isRunner: false,
      isRunnerMode: false,
      fontScale: 1.0,
      justLoggedOut: false,

      setUser: (user) =>
        set({
          user,
          isVendor: !!user?.vendor,
          isBuyer: !user?.vendor,
          isRunner: !!user?.is_runner,
        }),

      setFontSize: (size) => set({ fontScale: fontScaleMap[size] }),

      setRunnerMode: (active: boolean) => set({ isRunnerMode: active }),

      clear: () => set({ user: null, isVendor: false, isBuyer: true, isRunner: false, isRunnerMode: false }),

      setJustLoggedOut: (flag: boolean) => set({ justLoggedOut: flag }),
    }),
    {
      name: 'vendr-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user, fontScale, and isRunnerMode — others are derived on rehydration
      partialize: (state) => ({
        user: state.user,
        fontScale: state.fontScale,
        isRunnerMode: state.isRunnerMode,
      }),
      // Re-derive isVendor/isBuyer/isRunner after rehydration from persisted user
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.isVendor = !!state.user.vendor
          state.isBuyer = !state.user.vendor
          state.isRunner = !!state.user.is_runner
        }
      },
    }
  )
)