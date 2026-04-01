import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface Conversation {
  id: string;
  buyer_id: string;
  vendor_id: string;
  last_message: string | null;
  last_message_at: string;
  buyer_unread: number;
  vendor_unread: number;
  last_message_mine?: boolean;
  last_message_delivered?: boolean;
  last_message_read?: boolean;
  vendor: { id: string; business_name: string; is_verified: boolean; user_id: string } | null;
  buyer: { id: string; name: string; avatar_url: string | null } | null;
  other_online?: boolean;
  // Derived per-conversation role
  iAmVendor: boolean;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isThisYear) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function ConversationItem({ conv, myId }: { conv: Conversation; myId: string }) {
  // Role is per-conversation, not global
  const otherName = conv.iAmVendor
    ? (conv.buyer?.name || 'Unknown Buyer')
    : (conv.vendor?.business_name || 'Unknown Vendor');
  const unread = conv.iAmVendor ? conv.vendor_unread : conv.buyer_unread;
  const initials = (otherName ?? 'U').slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: conv.id } })}
      activeOpacity={0.75}
      className="flex-row items-center px-5 py-4 border-b border-faint gap-3"
    >
      <View className="relative">
        <View className="w-12 h-12 rounded-full bg-dark-2 border border-faint items-center justify-center">
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#E8521A' }}>
            {initials}
          </Text>
        </View>
        {conv.other_online && (
          <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-dark" />
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-cream text-sm"
              style={{ fontFamily: unread > 0 ? 'SpaceGrotesk_700Bold' : 'SpaceGrotesk_500Medium' }}
            >
              {otherName}
            </Text>
            {!conv.iAmVendor && conv.vendor?.is_verified && (
              <Ionicons name="shield-checkmark" size={12} color="#2D8653" />
            )}
            {/* Label so dual-role users know which context */}
            {conv.iAmVendor && (
              <View style={{ backgroundColor: 'rgba(245,166,35,0.15)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#F5A623' }}>AS VENDOR</Text>
              </View>
            )}
          </View>
          <Text className="text-xs" style={{ fontFamily: 'SpaceGrotesk_400Regular', color: unread > 0 ? '#E8521A' : '#6B5E50' }}>
            {formatTime(conv.last_message_at)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1 flex-1 mr-2">
            {conv.last_message_mine && (
              <Ionicons
                name={conv.last_message_read ? 'checkmark-done' : conv.last_message_delivered ? 'checkmark-done' : 'checkmark'}
                size={13}
                color={conv.last_message_read ? '#E8521A' : conv.last_message_delivered ? '#9A8570' : '#6B5E50'}
              />
            )}
            <Text
              className="text-sm flex-1"
              style={{
                fontFamily: unread > 0 ? 'SpaceGrotesk_500Medium' : 'SpaceGrotesk_400Regular',
                color: unread > 0 ? '#FDF6EC' : '#9A8570',
              }}
              numberOfLines={1}
            >
              {conv.last_message ?? 'Start a conversation'}
            </Text>
          </View>
          {unread > 0 && (
            <View style={{
              backgroundColor: '#E8521A',
              borderRadius: 12,
              minWidth: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
            }}>
              <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', color: 'white', lineHeight: 14 }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const { session } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // Find vendor records owned by this user (could be multiple)
    const { data: myVendors } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', userId);
    const myVendorIds = (myVendors ?? []).map(v => v.id);

    // Fetch ALL conversations where user is buyer OR vendor owner
    // We do two queries and merge
    const [buyerRes, vendorRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, buyer_id, vendor_id, last_message, last_message_at, buyer_unread, vendor_unread')
        .eq('buyer_id', userId)
        .order('last_message_at', { ascending: false }),
      myVendorIds.length > 0
        ? supabase
            .from('conversations')
            .select('id, buyer_id, vendor_id, last_message, last_message_at, buyer_unread, vendor_unread')
            .in('vendor_id', myVendorIds)
            .order('last_message_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Merge and deduplicate, tagging each with role
    const buyerConvs = (buyerRes.data ?? []).map(c => ({ ...c, iAmVendor: false }));
    const vendorConvs = (vendorRes.data ?? []).map(c => ({ ...c, iAmVendor: true }));

    // Deduplicate by id (a dual-role user could theoretically appear in both)
    const seenIds = new Set<string>();
    const allConvs = [...vendorConvs, ...buyerConvs].filter(c => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    if (allConvs.length === 0) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Sort merged list by last_message_at
    allConvs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    const vendorIds = [...new Set(allConvs.map(c => c.vendor_id))];
    const buyerIds = [...new Set(allConvs.map(c => c.buyer_id))];

    const [{ data: vendors }, { data: buyers }] = await Promise.all([
      supabase.from('vendors').select('id, business_name, is_verified, user_id').in('id', vendorIds),
      supabase.from('profiles').select('id, name, avatar_url').in('id', buyerIds),
    ]);

    const vendorMap = Object.fromEntries((vendors ?? []).map(v => [v.id, v]));
    const buyerMap = Object.fromEntries((buyers ?? []).map(b => [b.id, b]));

    // Presence — other user per conversation
    const otherUserIds = allConvs.map(c =>
      c.iAmVendor ? c.buyer_id : vendorMap[c.vendor_id]?.user_id
    ).filter(Boolean) as string[];

    const { data: presenceData } = await supabase
      .from('user_presence').select('user_id, is_online').in('user_id', [...new Set(otherUserIds)]);
    const onlineMap = Object.fromEntries((presenceData ?? []).map(p => [p.user_id, p.is_online]));

    // Last message status
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, delivered, is_read, created_at')
      .in('conversation_id', allConvs.map(c => c.id))
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, any> = {};
    (lastMsgs ?? []).forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
    });

    const enriched: Conversation[] = allConvs.map(c => {
      const lastMsg = lastMsgMap[c.id];
      const otherUserId = c.iAmVendor ? c.buyer_id : vendorMap[c.vendor_id]?.user_id;
      return {
        ...c,
        vendor: vendorMap[c.vendor_id] ?? null,
        buyer: buyerMap[c.buyer_id] ?? null,
        other_online: onlineMap[otherUserId] ?? false,
        last_message_mine: lastMsg?.sender_id === userId,
        last_message_delivered: lastMsg?.delivered ?? false,
        last_message_read: lastMsg?.is_read ?? false,
      };
    });

    setConversations(enriched);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchConversations(); }, [session]));

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel('conversation-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const totalUnread = conversations.reduce((sum, c) =>
    sum + (c.iAmVendor ? c.vendor_unread : c.buyer_unread), 0
  );

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      <View className="px-5 pt-14 pb-4 border-b border-faint">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Messages</Text>
            {totalUnread > 0 && (
              <Text className="text-orange text-xs mt-0.5" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                {totalUnread} unread message{totalUnread > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="w-20 h-20 rounded-3xl bg-dark-2 border border-faint items-center justify-center">
            <Ionicons name="chatbubbles-outline" size={36} color="#3D3026" />
          </View>
          <Text className="text-cream text-xl text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>No messages yet</Text>
          <Text className="text-muted text-sm text-center">Find a vendor and tap Chat to start a conversation</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} className="bg-orange rounded-2xl px-6 py-3 mt-2">
            <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Browse Vendors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <ConversationItem conv={item} myId={session?.user?.id ?? ''} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchConversations(); }}
              tintColor="#E8521A"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}