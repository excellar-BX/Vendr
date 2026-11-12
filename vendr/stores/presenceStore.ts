import { useEffect, useState } from 'react'
import { create } from 'zustand'

export interface Presence {
  isOnline: boolean
  lastSeen?: string | null
}

interface PresenceState {
  userPresence: Record<string, Presence>
  /** conversationId → userId currently typing there */
  typing: Record<string, string | undefined>
  activeConversationId: string | null
  /** Bumped whenever the socket (re)connects so screens can resync */
  connectionEpoch: number

  setActiveConversationId: (conversationId: string | null) => void
  setUserPresence: (userId: string, isOnline: boolean, lastSeen?: string | null) => void
  /** Seed from REST responses without clobbering fresher socket data */
  seedPresence: (entries: Array<{ userId: string; isOnline: boolean; lastSeen?: string | null }>) => void
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void
  bumpConnectionEpoch: () => void
  getUserPresence: (userId: string) => Presence | undefined
  clearPresence: () => void
}

// Typing indicators clear themselves if the "stopped" event never arrives
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const TYPING_TTL_MS = 6000

// Track which users got live (socket) updates so REST seeds don't overwrite them
const liveUpdated = new Set<string>()

export const usePresenceStore = create<PresenceState>((set, get) => ({
  userPresence: {},
  typing: {},
  activeConversationId: null,
  connectionEpoch: 0,

  setActiveConversationId: (conversationId) => {
    set({ activeConversationId: conversationId })
  },

  setUserPresence: (userId, isOnline, lastSeen) => {
    if (!userId) return
    liveUpdated.add(userId)
    set((state) => ({
      userPresence: {
        ...state.userPresence,
        [userId]: { isOnline, lastSeen: lastSeen ?? state.userPresence[userId]?.lastSeen ?? null },
      },
    }))
  },

  seedPresence: (entries) => {
    const next = { ...get().userPresence }
    let changed = false
    for (const e of entries) {
      if (!e.userId || liveUpdated.has(e.userId)) continue
      const cur = next[e.userId]
      if (cur?.isOnline === e.isOnline && cur?.lastSeen === (e.lastSeen ?? null)) continue
      next[e.userId] = { isOnline: e.isOnline, lastSeen: e.lastSeen ?? null }
      changed = true
    }
    if (changed) set({ userPresence: next })
  },

  setTyping: (conversationId, userId, isTyping) => {
    const existing = typingTimers.get(conversationId)
    if (existing) clearTimeout(existing)
    typingTimers.delete(conversationId)

    if (isTyping) {
      typingTimers.set(
        conversationId,
        setTimeout(() => get().setTyping(conversationId, userId, false), TYPING_TTL_MS)
      )
    }
    set((state) => {
      if (!!state.typing[conversationId] === isTyping) return state
      return { typing: { ...state.typing, [conversationId]: isTyping ? userId : undefined } }
    })
  },

  bumpConnectionEpoch: () => {
    // After a reconnect, socket data is authoritative again from scratch
    liveUpdated.clear()
    set((state) => ({ connectionEpoch: state.connectionEpoch + 1 }))
  },

  getUserPresence: (userId) => get().userPresence[userId],

  clearPresence: () => {
    liveUpdated.clear()
    typingTimers.forEach(clearTimeout)
    typingTimers.clear()
    set({ userPresence: {}, typing: {}, activeConversationId: null })
  },
}))

/** Reactive presence for one user — re-renders only when that user's status changes. */
export function usePresence(userId?: string | null): Presence | undefined {
  return usePresenceStore((s) => (userId ? s.userPresence[userId] : undefined))
}

/** Reactive "is the other person typing" for a conversation. */
export function useIsTyping(conversationId?: string | null): boolean {
  return usePresenceStore((s) => (conversationId ? !!s.typing[conversationId] : false))
}

/**
 * WhatsApp-style status line:
 *   "last seen today at 14:02" · "last seen yesterday at 21:10"
 *   "last seen Monday at 09:15" (this week) · "last seen 3 Nov at 18:40" · "last seen 3 Nov 2025"
 */
export function formatLastSeen(lastSeen?: string | null): string {
  if (!lastSeen) return 'offline'
  const d = new Date(lastSeen)
  if (isNaN(d.getTime())) return 'offline'
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)

  if (daysAgo <= 0) return `last seen today at ${time}`
  if (daysAgo === 1) return `last seen yesterday at ${time}`
  if (daysAgo < 7) return `last seen ${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`
  if (d.getFullYear() === now.getFullYear()) {
    return `last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${time}`
  }
  return `last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/** Re-render every `ms` so relative labels ("today" → "yesterday") stay correct. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
