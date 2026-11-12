import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { ChatAvatar } from '../../components/chat/ChatAvatar';
import { useAuthStore } from '../../stores/authStore';
import { useIsTyping, usePresenceStore } from '../../stores/presenceStore';
import { onSocketStatus, SocketStatus } from '../../lib/socket';
import {
  useConversations, ConversationItem, getUnread, getOtherName, getOtherAvatar, getOtherUserId,
} from '../../hooks/useConversations';
import { T, useTheme } from '../../constants/theme';

type Filter = 'all' | 'unread' | 'buying' | 'selling';

function formatListTime(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = (now.getTime() - date.getTime()) / 86_400_000;
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleDateString([], { year: '2-digit', month: 'short', day: 'numeric' });
}

// ── Row ─────────────────────────────────────────────────────────────────────
const ConversationRow = memo(function ConversationRow({ conv, showRole }: { conv: ConversationItem; showRole: boolean }) {
  useTheme();
  const typing = useIsTyping(conv.id);
  const unread = getUnread(conv);
  const name = getOtherName(conv);
  const hasUnread = unread > 0;

  const preview = (() => {
    if (conv.last_message_deleted) return { icon: 'ban-outline' as const, text: 'Message deleted', italic: true };
    if (conv.last_message_type === 'image' || conv.last_message === 'Photo') return { icon: 'image-outline' as const, text: 'Photo' };
    if (conv.last_message_type === 'payment_request' || conv.last_message === 'Payment request') {
      return { icon: 'cash-outline' as const, text: 'Payment request' };
    }
    if (!conv.last_message) return { icon: null, text: conv.iAmVendor ? 'New enquiry' : 'Say hello 👋', italic: true };
    return { icon: null, text: conv.last_message };
  })();

  return (
    // Static style on purpose: NativeWind's Pressable wrapper can drop function
    // styles, which collapsed this row into a vertical stack.
    <TouchableOpacity
      onPress={() => router.push({
        pathname: '/chat/[conversationId]',
        // Header info travels with the navigation so the chat opens fully drawn
        params: {
          conversationId: conv.id,
          name,
          avatar: getOtherAvatar(conv) ?? '',
          uid: getOtherUserId(conv) ?? '',
          asVendor: conv.iAmVendor ? '1' : '0',
          verified: !conv.iAmVendor && conv.vendor?.is_verified ? '1' : '0',
          vid: conv.vendor?.id ?? '',
        },
      })}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: 16, paddingVertical: 12, width: '100%',
      }}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}${hasUnread ? `, ${unread} unread` : ''}`}
    >
      <ChatAvatar uri={getOtherAvatar(conv)} name={name} userId={getOtherUserId(conv)} size={54} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1, fontSize: 15, color: T.ink,
                fontFamily: hasUnread ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
              }}
            >
              {name}
            </Text>
            {!conv.iAmVendor && conv.vendor?.is_verified && (
              <Ionicons name="shield-checkmark" size={13} color={T.successInk} />
            )}
            {showRole && (
              <View style={{
                backgroundColor: conv.iAmVendor ? T.goldSoft : T.infoSoft,
                borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5,
              }}>
                <Text style={{
                  fontSize: 9.5, letterSpacing: 0.3, fontFamily: 'PlusJakartaSans_700Bold',
                  color: conv.iAmVendor ? T.goldInk : T.infoInk,
                }}>
                  {conv.iAmVendor ? 'SELLING' : 'BUYING'}
                </Text>
              </View>
            )}
          </View>
          <Text style={{
            fontSize: 12,
            fontFamily: hasUnread ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
            color: hasUnread ? T.primaryInk : T.ink3,
          }}>
            {formatListTime(conv.last_message_at)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
            {typing ? (
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_500Medium', color: T.primaryInk }}>
                typing…
              </Text>
            ) : (
              <>
                {conv.last_message_mine && !conv.last_message_deleted && conv.last_message && (
                  <Ionicons
                    name={conv.last_message_delivered || conv.last_message_read ? 'checkmark-done' : 'checkmark'}
                    size={15}
                    color={conv.last_message_read ? T.info : T.ink4}
                  />
                )}
                {preview.icon && <Ionicons name={preview.icon} size={14} color={hasUnread ? T.ink2 : T.ink3} />}
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1, fontSize: 13.5,
                    fontFamily: hasUnread ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                    fontStyle: preview.italic ? 'italic' : 'normal',
                    color: hasUnread ? T.ink : T.ink3,
                  }}
                >
                  {preview.text}
                </Text>
              </>
            )}
          </View>
          {hasUnread && (
            <View style={{
              backgroundColor: T.primary, borderRadius: 11, minWidth: 22, height: 22,
              alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
            }}>
              <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── Loading skeleton ────────────────────────────────────────────────────────
function SkeletonRow() {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: T.surface2 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '45%', height: 12, borderRadius: 6, backgroundColor: T.surface2 }} />
        <View style={{ width: '75%', height: 10, borderRadius: 5, backgroundColor: T.surface2 }} />
      </View>
    </View>
  );
}

function FilterChip({ label, active, count, onPress }: { label: string; active: boolean; count?: number; onPress: () => void }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, height: 34, borderRadius: 17,
        backgroundColor: active ? T.ink : T.surface,
        borderWidth: 1, borderColor: active ? T.ink : T.line,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: active ? T.canvas : T.ink2 }}>
        {label}
      </Text>
      {!!count && (
        <View style={{
          minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
          backgroundColor: active ? T.primary : T.primarySoft, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: active ? T.onPrimary : T.primaryInk }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function ChatListScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isRefetching } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [manualRefresh, setManualRefresh] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('idle');

  useEffect(() => onSocketStatus(setSocketStatus), []);

  // Always resync when the tab regains focus (cheap; cached data shows instantly)
  useFocusEffect(useCallback(() => {
    // Looking at the list means no chat is open — never let a stale value
    // suppress unread counts for incoming messages.
    usePresenceStore.getState().setActiveConversationId(null);
    if (user?.id) refetch();
  }, [user?.id, refetch]));

  const conversations = data ?? [];
  const isDualRole = useMemo(
    () => conversations.some((c) => c.iAmVendor) && conversations.some((c) => !c.iAmVendor),
    [conversations]
  );
  const unreadConvs = useMemo(() => conversations.filter((c) => getUnread(c) > 0).length, [conversations]);

  // Reset an unavailable filter (e.g. "Selling" when the user no longer has vendor chats)
  useEffect(() => {
    if (!isDualRole && (filter === 'buying' || filter === 'selling')) setFilter('all');
  }, [isDualRole, filter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && getUnread(c) === 0) return false;
      if (filter === 'buying' && c.iAmVendor) return false;
      if (filter === 'selling' && !c.iAmVendor) return false;
      if (!q) return true;
      return getOtherName(c).toLowerCase().includes(q) || (c.last_message ?? '').toLowerCase().includes(q);
    });
  }, [conversations, filter, searchQuery]);

  const onRefresh = async () => {
    setManualRefresh(true);
    try { await refetch(); } finally { setManualRefresh(false); }
  };

  const showConnecting = socketStatus === 'connecting' || socketStatus === 'disconnected';

  const renderEmpty = () => {
    if (isLoading) return <View>{Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}</View>;
    if (isError && conversations.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.ink4} />
          <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Couldn't load chats</Text>
          <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center' }}>Check your connection and try again.</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 8, backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.onPrimary }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const searching = !!searchQuery.trim() || filter !== 'all';
    return (
      <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: 32, gap: 10 }}>
        <View style={{
          width: 84, height: 84, borderRadius: 28, backgroundColor: T.primarySoft,
          alignItems: 'center', justifyContent: 'center', marginBottom: 6,
        }}>
          <Ionicons name={searching ? 'search' : 'chatbubbles'} size={36} color={T.primary} />
        </View>
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink, textAlign: 'center' }}>
          {searching ? 'No chats found' : 'No messages yet'}
        </Text>
        <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center', lineHeight: 20 }}>
          {searching
            ? filter === 'unread' && !searchQuery ? "You're all caught up." : 'Try a different name or filter.'
            : 'Find a vendor you like and tap Chat to ask about a product.'}
        </Text>
        {!searching && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{ marginTop: 10, backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.onPrimary }}>Browse vendors</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.5 }}>
              Messages
            </Text>
            {showConnecting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.gold }} />
                <Text style={{ fontSize: 12.5, color: T.ink3, fontFamily: 'PlusJakartaSans_500Medium' }}>Connecting…</Text>
              </View>
            ) : unreadConvs > 0 ? (
              <Text style={{ fontSize: 12.5, color: T.ink3, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 }}>
                {unreadConvs} unread {unreadConvs === 1 ? 'chat' : 'chats'}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.line,
          paddingHorizontal: 12, height: 44,
        }}>
          <Ionicons name="search" size={18} color={T.ink3} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search chats"
            placeholderTextColor={T.ink4}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: T.ink, fontFamily: 'PlusJakartaSans_500Medium', paddingVertical: 0 }}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={T.ink4} />
            </TouchableOpacity>
          )}
        </View>

        {conversations.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="Unread" active={filter === 'unread'} count={unreadConvs} onPress={() => setFilter('unread')} />
            {isDualRole && (
              <>
                <FilterChip label="Buying" active={filter === 'buying'} onPress={() => setFilter('buying')} />
                <FilterChip label="Selling" active={filter === 'selling'} onPress={() => setFilter('selling')} />
              </>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow conv={item} showRole={isDualRole} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: T.line, marginLeft: 84 }} />}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={manualRefresh && isRefetching}
            onRefresh={onRefresh}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
