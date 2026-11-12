import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { chatApi } from '../lib/api';
import { onSocketEvent } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';
import { usePresenceStore } from '../stores/presenceStore';

export interface ConversationItem {
  id: string;
  buyer_id: string;
  vendor_id: string;
  last_message: string | null;
  last_message_at: string;
  last_message_id?: string | null;
  last_message_type?: string | null;
  last_message_mine?: boolean;
  last_message_delivered?: boolean;
  last_message_read?: boolean;
  last_message_deleted?: boolean;
  buyer_unread: number;
  vendor_unread: number;
  vendor: {
    id: string;
    business_name: string;
    is_verified?: boolean;
    user_id: string;
    logo_url?: string | null;
    avatar_url?: string | null;
  } | null;
  buyer: { id: string; name: string | null; avatar_url: string | null } | null;
  iAmVendor: boolean;
  other_user_id?: string | null;
  other_online?: boolean;
  other_last_seen?: string | null;
}

export const conversationsKey = (userId?: string | null) => ['conversations', userId ?? 'anon'] as const;

export const getUnread = (c: ConversationItem) => (c.iAmVendor ? c.vendor_unread : c.buyer_unread) ?? 0;
export const getOtherUserId = (c: ConversationItem) =>
  c.other_user_id ?? (c.iAmVendor ? c.buyer_id : c.vendor?.user_id) ?? null;
export const getOtherName = (c: ConversationItem) =>
  c.iAmVendor ? c.buyer?.name || 'Customer' : c.vendor?.business_name || 'Vendor';
export const getOtherAvatar = (c: ConversationItem) =>
  c.iAmVendor ? c.buyer?.avatar_url ?? null : c.vendor?.logo_url || c.vendor?.avatar_url || null;

function withUnread(c: ConversationItem, value: number | ((n: number) => number)): ConversationItem {
  const next = typeof value === 'function' ? value(getUnread(c)) : value;
  return c.iAmVendor ? { ...c, vendor_unread: next } : { ...c, buyer_unread: next };
}

function previewFor(type: string | undefined, content: string | null | undefined) {
  if (type === 'image') return 'Photo';
  if (type === 'payment_request') return 'Payment request';
  return content ?? '';
}

type Updater = (list: ConversationItem[]) => ConversationItem[];
function patch(qc: QueryClient, userId: string, fn: Updater) {
  qc.setQueryData<ConversationItem[]>(conversationsKey(userId), (old) => (old ? fn(old) : old));
}

/** Locally clear the unread badge for a conversation (e.g. when it's opened). */
export function markConversationReadLocally(qc: QueryClient, userId: string, conversationId: string) {
  patch(qc, userId, (list) => list.map((c) => (c.id === conversationId && getUnread(c) > 0 ? withUnread(c, 0) : c)));
}

/** The conversation list, cached and shared across screens. */
export function useConversations() {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useQuery<ConversationItem[]>({
    queryKey: conversationsKey(userId),
    queryFn: async () => {
      const { data } = await chatApi.getConversations();
      return (data ?? []) as ConversationItem[];
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  // Seed presence for everyone in the list (socket updates take precedence)
  useEffect(() => {
    if (!query.data?.length) return;
    usePresenceStore.getState().seedPresence(
      query.data
        .map((c) => ({ userId: getOtherUserId(c) ?? '', isOnline: !!c.other_online, lastSeen: c.other_last_seen }))
        .filter((e) => e.userId)
    );
  }, [query.data]);

  return query;
}

export function useChatUnreadTotal() {
  const { data } = useConversations();
  return useMemo(() => (data ?? []).reduce((sum, c) => sum + getUnread(c), 0), [data]);
}

/**
 * Keeps the cached conversation list in sync with socket events.
 * Mount exactly once (in the tabs layout, which stays mounted under pushed screens).
 */
export function useConversationsRealtime() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const refetchSoon = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => qc.invalidateQueries({ queryKey: conversationsKey(userId) }), 400);
    };

    const offs = [
      onSocketEvent('new_message', (m: any) => {
        if (__DEV__) console.log('[ChatList] new_message', m.conversation_id, m.id);
        const key = conversationsKey(userId);
        // A list fetch that started before this message existed would otherwise
        // land afterwards and overwrite the update — cancel it first.
        qc.cancelQueries({ queryKey: key });
        const list = qc.getQueryData<ConversationItem[]>(key);
        const idx = list?.findIndex((c) => c.id === m.conversation_id) ?? -1;
        if (!list || idx === -1) {
          // A brand-new conversation (or list not loaded yet) — fetch it
          refetchSoon();
          return;
        }
        patch(qc, userId, (items) => {
          const i = items.findIndex((c) => c.id === m.conversation_id);
          if (i === -1) return items;
          const cur = items[i];
          if (cur.last_message_id === m.id) return items; // already applied
          const mine = m.sender_id === userId;
          const viewing = usePresenceStore.getState().activeConversationId === cur.id;
          let next: ConversationItem = {
            ...cur,
            last_message: previewFor(m.type, m.content),
            last_message_type: m.type,
            last_message_at: m.created_at ?? new Date().toISOString(),
            last_message_id: m.id,
            last_message_mine: mine,
            last_message_delivered: !!m.delivered,
            last_message_read: !!m.is_read,
            last_message_deleted: false,
          };
          if (!mine && !viewing) next = withUnread(next, (n) => n + 1);
          return [next, ...items.slice(0, i), ...items.slice(i + 1)];
        });
        // Always confirm against the server — it owns the unread counts. Never gate this on
        // "is the chat open" client state: if that flag goes stale, badges silently vanish.
        // (If the chat really is open, it marks the message read and the follow-up
        // messages_read refetch settles the count at 0.)
        if (m.sender_id !== userId) refetchSoon();
      }),

      onSocketEvent('messages_read', (d: { conversationId: string; messageIds: string[]; readBy: string }) => {
        // I read it (on this or another device): the server counter is now 0 — resync so an
        // earlier in-flight refetch can't leave a stale badge behind.
        if (d.readBy === userId) refetchSoon();
        patch(qc, userId, (items) =>
          items.map((c) => {
            if (c.id !== d.conversationId) return c;
            if (d.readBy === userId) return getUnread(c) > 0 ? withUnread(c, 0) : c;
            if (!c.last_message_mine) return c;
            const covers = !c.last_message_id || d.messageIds.includes(c.last_message_id);
            return covers ? { ...c, last_message_read: true, last_message_delivered: true } : c;
          })
        );
      }),

      onSocketEvent('message_delivered', (d: { conversationId: string; userId: string; messageIds?: string[] }) => {
        if (d.userId === userId) return;
        patch(qc, userId, (items) =>
          items.map((c) =>
            c.id === d.conversationId && c.last_message_mine && !c.last_message_delivered
              ? { ...c, last_message_delivered: true }
              : c
          )
        );
      }),

      onSocketEvent('message_updated', (m: any) => {
        patch(qc, userId, (items) =>
          items.map((c) => (c.id === m.conversation_id && c.last_message_id === m.id ? { ...c, last_message: m.content } : c))
        );
      }),

      onSocketEvent('message_deleted', (d: { conversationId: string; messageId: string }) => {
        const list = qc.getQueryData<ConversationItem[]>(conversationsKey(userId));
        if (list?.some((c) => c.id === d.conversationId && c.last_message_id === d.messageId)) refetchSoon();
      }),

      // Anything missed while disconnected
      onSocketEvent('connect', refetchSoon),
    ];

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      offs.forEach((off) => off());
    };
  }, [qc, userId]);
}
