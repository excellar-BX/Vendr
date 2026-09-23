import { create } from 'zustand'

interface PresenceState {
  userPresence: Record<string, { isOnline: boolean; lastSeen?: string }>
  activeConversationId: string | null
  setActiveConversationId: (conversationId: string | null) => void
  setUserPresence: (userId: string, isOnline: boolean, lastSeen?: string) => void
  getUserPresence: (userId: string) => { isOnline: boolean; lastSeen?: string } | undefined
  clearPresence: () => void
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  userPresence: {},
  activeConversationId: null,

  setActiveConversationId: (conversationId: string | null) => {
    set({ activeConversationId: conversationId })
  },

  setUserPresence: (userId: string, isOnline: boolean, lastSeen?: string) => {
    set((state) => ({
      userPresence: {
        ...state.userPresence,
        [userId]: { isOnline, lastSeen },
      },
    }))
  },

  getUserPresence: (userId: string) => {
    return get().userPresence[userId]
  },

  clearPresence: () => {
    set({ userPresence: {}, activeConversationId: null })
  },
}))
