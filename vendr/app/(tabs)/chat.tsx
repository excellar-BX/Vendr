import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { chatApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket'; 

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
  vendor: { id: string; logo_url?: string | null; avatar_url?: string | null; business_name: string; is_verified: boolean; user_id: string } | null;
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
  const otherName = conv.iAmVendor
    ? (conv.buyer?.name || 'Unknown Buyer')
    : (conv.vendor?.business_name || 'Unknown Vendor');
  const unread = conv.iAmVendor ? conv.vendor_unread : conv.buyer_unread;
  const initials = (otherName ?? 'U').slice(0, 2).toUpperCase();

  const fallbackAvatar = () => (
    <View className="w-12 h-12 rounded-full bg-dark-2 border border-faint items-center justify-center">
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#E8521A' }}>
        {initials}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: conv.id } })}
      activeOpacity={0.75}
      className="flex-row items-center px-5 py-4 border-b border-faint gap-3"
    >
      <View className="relative">
        {conv.iAmVendor ? (
          conv.buyer?.avatar_url ? (
            <Image source={{ uri: conv.buyer.avatar_url }} className="w-12 h-12 rounded-full border border-faint" />
          ) : fallbackAvatar()
        ) : (
          conv.vendor?.logo_url ? (
            <Image source={{ uri: conv.vendor.logo_url }} className="w-12 h-12 rounded-full border border-faint" />
          ) : conv.vendor?.avatar_url ? (
            <Image source={{ uri: conv.vendor.avatar_url }} className="w-12 h-12 rounded-full border border-faint" />
          ) : fallbackAvatar()
        )}
        <View className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-dark ${conv.other_online ? 'bg-green-500' : 'bg-dark-3'}`} />
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
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = async (isSilent = false) => {
    if (!user?.id) return;
    if (!isSilent && !refreshing) setLoading(true);

    try {
      const { data } = await chatApi.getConversations();
      setConversations(data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchConversations(true); }, [user]));

  // FIX #10: Filter logic
  const filteredConversations = conversations.filter(c => {
    const name = c.iAmVendor ? c.buyer?.name : c.vendor?.business_name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // FIX #1: Real-time update list WITHOUT full API refresh
  useEffect(() => {
    let mounted = true;
    let socketListenerCleanup: (() => void) | undefined;

    const setupSocket = async () => {
      const socket = await connectSocket();
      if (!socket || !mounted) return;

      const onNewMessage = (data: { conversation_id: string; content: string; sender_id: string; type?: string }) => {
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === data.conversation_id);
          if (index === -1) {
            fetchConversations(true);
            return prev;
          }
          const updated = [...prev];
          const conv = { ...updated[index] };

          conv.last_message = data.type === 'image'
            ? 'Photo'
            : data.type === 'payment_request'
            ? 'Payment request'
            : data.content;
          conv.last_message_at = new Date().toISOString();
          conv.last_message_mine = data.sender_id === user?.id;

          if (data.sender_id !== user?.id) {
            if (conv.iAmVendor) conv.vendor_unread = (conv.vendor_unread ?? 0) + 1;
            else conv.buyer_unread = (conv.buyer_unread ?? 0) + 1;
          }

          updated.splice(index, 1);
          return [conv, ...updated];
        });
      };

      const onMessagesRead = (data: { conversationId: string; readBy: string }) => {
        setConversations(prev => prev.map(conv => {
          if (conv.id !== data.conversationId) return conv;
          const otherUserId = conv.iAmVendor ? conv.buyer_id : conv.vendor?.user_id;
          if (otherUserId === data.readBy && conv.last_message_mine) {
            const updated = { ...conv };
            updated.last_message_read = true;
            return updated;
          }
          return conv;
        }));
      };

      const onUserPresence = (data: { userId: string; isOnline: boolean }) => {
        setConversations(prev => prev.map(conv => {
          const otherUserId = conv.iAmVendor ? conv.buyer_id : conv.vendor?.user_id;
          if (otherUserId === data.userId) {
            return { ...conv, other_online: data.isOnline };
          }
          return conv;
        }));
      };

      socket.on('new_message', onNewMessage);
      socket.on('messages_read', onMessagesRead);
      socket.on('user_presence', onUserPresence);
      socket.on('message_deleted', (data: { conversationId: string }) => {
        setConversations(prev => prev.map(conv => {
          if (conv.id !== data.conversationId) return conv;
          return {
            ...conv,
            last_message: conv.last_message_mine ? 'Deleted' : (conv.last_message ?? ''),
          };
        }));
      });

      socketListenerCleanup = () => {
        socket.off('new_message', onNewMessage);
        socket.off('messages_read', onMessagesRead);
        socket.off('user_presence', onUserPresence);
        socket.off('message_deleted', () => {});
      };
    };

    setupSocket();

    return () => {
      mounted = false;
      socketListenerCleanup?.();
    };
  }, [user]);

  const totalUnread = conversations.reduce((sum, c) =>
    sum + (c.iAmVendor ? c.vendor_unread : c.buyer_unread), 0
  );

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      <View className="px-5 pt-14 pb-4 border-b border-faint">
        <Text style={{fontFamily: 'SpaceGrotesk_700Bold'}} className="text-cream text-2xl">Messages</Text>
        
        {/* FIX #10: Search Bar */}
        <View className="mt-4 bg-dark-2 rounded-xl flex-row items-center px-3 py-2 border border-faint">
          <Ionicons name="search" size={18} color="#6B5E50" />
          <TextInput 
            className="flex-1 ml-2 text-cream" 
            placeholder="Search chats..." 
            placeholderTextColor="#6B5E50"
            value={searchQuery}
            style={{fontFamily: 'SpaceGrotesk_500Medium'}}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="w-20 h-20 rounded-3xl bg-dark-2 border border-faint items-center justify-center">
            <Ionicons name="chatbubbles-outline" size={36} color="#3D3026" />
          </View>
          <Text className="text-cream text-xl text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            {searchQuery ? 'No results found' : 'No messages yet'}
          </Text>
          <Text className="text-muted text-sm text-center">
            {searchQuery ? 'Try a different search term' : 'Find a vendor and tap Chat to start a conversation'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity onPress={() => router.push('/(tabs)')} className="bg-orange rounded-2xl px-6 py-3 mt-2">
              <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Browse Vendors</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <ConversationItem conv={item} myId={user?.id ?? ''} />
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