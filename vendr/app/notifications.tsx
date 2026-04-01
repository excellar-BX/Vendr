import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type NotificationType =
  | 'new_message'
  | 'new_order'
  | 'order_placed'
  | 'order_status'
  | 'store_saved'
  | 'vendor_verified'
  | 'review_received'
  | 'payment_request';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  data: Record<string, any>;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: IoniconsName; color: string; bg: string }> = {
  new_message:     { icon: 'chatbubble',           color: '#E8521A', bg: 'rgba(232,82,26,0.15)' },
  new_order:       { icon: 'bag-handle',           color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
  order_placed:    { icon: 'checkmark-circle',     color: '#2D8653', bg: 'rgba(45,134,83,0.15)' },
  order_status:    { icon: 'refresh-circle',       color: '#5599E8', bg: 'rgba(85,153,232,0.15)' },
  store_saved:     { icon: 'heart',                color: '#E85580', bg: 'rgba(232,85,128,0.15)' },
  vendor_verified: { icon: 'shield-checkmark',     color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
  review_received: { icon: 'star',                 color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
  payment_request: { icon: 'wallet',               color: '#2D8653', bg: 'rgba(45,134,83,0.15)' },
};

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function NotificationItem({ notif, onPress }: { notif: AppNotification; onPress: (n: AppNotification) => void }) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG['new_message'];

  return (
    <TouchableOpacity
      onPress={() => onPress(notif)}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingVertical: 14, gap: 12,
        backgroundColor: notif.is_read ? 'transparent' : 'rgba(232,82,26,0.04)',
        borderBottomWidth: 1, borderBottomColor: '#1A1208',
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{
            fontFamily: notif.is_read ? 'SpaceGrotesk_500Medium' : 'SpaceGrotesk_700Bold',
            fontSize: 14, color: '#FDF6EC', flex: 1,
          }} numberOfLines={1}>
            {notif.title}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', flexShrink: 0 }}>
            {formatTime(notif.created_at)}
          </Text>
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 18 }} numberOfLines={2}>
          {notif.body}
        </Text>
      </View>

      {!notif.is_read && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8521A', marginTop: 6, flexShrink: 0 }} />
      )}
    </TouchableOpacity>
  );
}

function groupByDate(notifs: AppNotification[]) {
  const groups: { label: string; items: AppNotification[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  notifs.forEach(n => {
    const d = new Date(n.created_at).toDateString();
    const label = d === today ? 'Today'
      : d === yesterday ? 'Yesterday'
      : new Date(n.created_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const existing = groups.find(g => g.label === label);
    if (existing) existing.items.push(n);
    else groups.push({ label, items: [n] });
  });
  return groups;
}

export default function NotificationsScreen() {
  const { session } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userId = session?.user?.id;

  const fetchNotifications = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);
    setNotifications((data ?? []) as AppNotification[]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [userId]));

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications-feed')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as AppNotification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markRead = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    // Navigate based on type
    if (notif.data?.conversation_id) {
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId: notif.data.conversation_id } });
    } else if (notif.data?.vendor_id) {
      router.push({ pathname: '/vendor/[id]', params: { id: notif.data.vendor_id } });
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const groups = groupByDate(notifications);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1208', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#E8521A' }}>{unreadCount} unread</Text>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            style={{
              paddingHorizontal: 12, paddingVertical: 7,
              backgroundColor: 'rgba(232,82,26,0.12)',
              borderRadius: 10, borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)',
            }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#E8521A' }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 22,
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="notifications-off-outline" size={32} color="#3D3026" />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>All caught up</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', lineHeight: 22 }}>
            Activity from your chats, orders, and store will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#E8521A" colors={['#E8521A']} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {groups.map(group => (
            <View key={group.label}>
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {group.label}
                </Text>
              </View>
              {group.items.map(notif => (
                <NotificationItem key={notif.id} notif={notif} onPress={markRead} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}