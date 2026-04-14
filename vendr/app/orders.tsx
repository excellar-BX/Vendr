import { useState, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native';
import { Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { orderApi } from '../lib/api';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type OrderTab = 'bought' | 'sold';

interface Order {
  id: string;
  amount: number;
  description: string | null;
  status: 'completed' | 'refunded' | 'disputed' | 'pending';
  escrow_status: 'held' | 'released' | 'refunded';
  created_at: string;
  buyer_id: string;
  vendor_user_id: string;
  conversation_id: string | null;
  auto_release_at?: string;
  // joined
  vendor_name?: string;
  vendor_id?: string;
  buyer_name?: string;
  buyer_avatar?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  completed: { label: 'Completed', color: '#2D8653', icon: 'checkmark-circle-outline' },
  refunded:  { label: 'Refunded',  color: '#5599E8', icon: 'refresh-circle-outline'  },
  disputed:  { label: 'Disputed',  color: '#E85555', icon: 'alert-circle-outline'     },
  pending:   { label: 'Pending',   color: '#F5A623', icon: 'time-outline'            },
};

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatDate(iso: string) { 
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit',
  });
}

function groupByDate(orders: Order[]) {
  const groups: { label: string; items: Order[] }[] = [];
  const today    = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  orders.forEach(o => {
    const d = new Date(o.created_at).toDateString();
    const label = d === today ? 'Today'
      : d === yesterday ? 'Yesterday'
      : formatDate(o.created_at);
    const existing = groups.find(g => g.label === label);
    if (existing) existing.items.push(o);
    else groups.push({ label, items: [o] });
  });
  return groups;
}

function OrderCard({ order, mode, onOpenChat, onConfirmDelivery, onDispute, confirmingDelivery }: {
  order: Order;
  mode: OrderTab;
  onOpenChat: (conversationId: string) => void;
  onConfirmDelivery: (orderId: string) => void;
  onDispute: (orderId: string) => void;
  confirmingDelivery: string | null;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.completed;
  const isBought = mode === 'bought';
  const showConfirmButton = isBought && order.escrow_status === 'held';
  const showDisputeButton = isBought && order.escrow_status === 'held' && order.status !== 'disputed';

  return (
    <View style={{
      backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
      borderRadius: 20, padding: 16, gap: 12,
    }}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }}>
            {isBought ? order.vendor_name : order.buyer_name ?? 'A buyer'}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            {isBought ? 'Purchased from' : 'Sold to'}
            {' · '}
            {formatTime(order.created_at)}
          </Text>
        </View>

        {/* Status badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
          backgroundColor: cfg.color + '18', borderWidth: 1, borderColor: cfg.color + '30',
        }}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: cfg.color }}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {/* Escrow status for buyers */}
      {isBought && order.escrow_status === 'held' && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: 'rgba(45,134,83,0.1)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.2)',
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        }}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#2D8653" />
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#2D8653' }}>
            Payment held in escrow until delivery
          </Text>
        </View>
      )}

      {/* Description */}
      {order.description ? (
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 18 }}>
          {order.description}
        </Text>
      ) : null}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#2A1F14' }} />

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{
          fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18,
          color: isBought ? '#E8521A' : '#2D8653',
        }}>
          {isBought ? '−' : '+'}{formatAmount(order.amount)}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {order.conversation_id && (
            <TouchableOpacity
              onPress={() => onOpenChat(order.conversation_id!)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                backgroundColor: 'rgba(232,82,26,0.1)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.2)',
              }}
            >
              <Ionicons name="chatbubble-outline" size={14} color="#E8521A" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>
                View Chat
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} >
         {showConfirmButton && (
            <TouchableOpacity
              onPress={() => onConfirmDelivery(order.id)}
              disabled={confirmingDelivery === order.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                backgroundColor: confirmingDelivery === order.id ? '#1A150F' : '#2D8653',
                borderWidth: 1, borderColor: '#2D8653',
              }}
            >
              {confirmingDelivery === order.id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle" size={14} color="white" />
              )}
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'white' }}>
                {confirmingDelivery === order.id ? 'Confirming...' : 'Confirm Delivery'}
              </Text>
            </TouchableOpacity>
          )}

          {showDisputeButton && (
            <TouchableOpacity
              onPress={() => onDispute(order.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                backgroundColor: 'rgba(232,85,85,0.1)', borderWidth: 1, borderColor: 'rgba(232,85,85,0.2)',
              }}
            >
              <Ionicons name="alert-circle-outline" size={14} color="#E85555" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E85555' }}>
                Dispute
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const { user, isVendor } = useAuthStore();
  const [tab, setTab] = useState<OrderTab>('bought');
  const [boughtOrders, setBoughtOrders] = useState<Order[]>([]);
  const [soldOrders, setSoldOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);

  const userId = user?.id;

  const showTabs = isVendor;

  const fetchOrders = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch bought orders
      const boughtRes = await orderApi.getOrders('bought');
      const bought = boughtRes.data || [];
      setBoughtOrders(bought);

      // Fetch sold orders if vendor
      if (isVendor) {
        const soldRes = await orderApi.getOrders('sold');
        const sold = soldRes.data || [];
        setSoldOrders(sold);
      } else {
        setSoldOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setBoughtOrders([]);
      setSoldOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isVendor]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]));

  const handleOpenChat = (conversationId: string) => {
    router.push({ pathname: '/chat/[conversationId]', params: { conversationId } });
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingDelivery(orderId);
    try {
      const response = await orderApi.confirmDelivery(orderId);
      if (response.success) {
        // Refresh orders to update status
        await fetchOrders();
      }
    } catch (error) {
      console.error('Failed to confirm delivery:', error);
      alert('Failed to confirm delivery. Please try again.');
    } finally {
      setConfirmingDelivery(null);
    }
  };

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const handleDispute = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowDisputeModal(true);
  };

  const handleDisputeReason = (reason: string) => {
    setShowDisputeModal(false);
    if (selectedOrderId) {
      submitDispute(selectedOrderId, reason);
    }
    setSelectedOrderId(null);
  };

  const submitDispute = async (orderId: string, reason: string) => {
    try {
      await apiFetch('/disputes', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          reason,
          description: '',
        }),
      });
      Alert.alert('Success', 'Your dispute has been submitted. Our team will review it shortly.');
      fetchOrders();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit dispute');
    }
  };

  const activeOrders = tab === 'bought' ? boughtOrders : soldOrders;
  const groups = groupByDate(activeOrders);

  const EmptyState = ({ mode }: { mode: OrderTab }) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 22,
        backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={mode === 'bought' ? 'bag-outline' : 'storefront-outline'} size={30} color="#3D3026" />
      </View>
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center' }}>
        {mode === 'bought' ? 'No purchases yet' : 'No sales yet'}
      </Text>
      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', lineHeight: 22 }}>
        {mode === 'bought'
          ? 'When you pay a vendor through chat, your purchases will show up here.'
          : 'When buyers pay you through chat, your sales will appear here.'}
      </Text>
      {mode === 'bought' && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: 'white' }}>Browse Vendors</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1208', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>Orders</Text>
          {activeOrders.length > 0 && (
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
              {activeOrders.length} {tab === 'bought' ? 'purchase' : 'sale'}{activeOrders.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Tabs — only for dual-role users */}
      {showTabs && (
        <View style={{
          flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 4,
          backgroundColor: '#1A1208', borderRadius: 16, padding: 4,
          borderWidth: 1, borderColor: '#2A1F14',
        }}>
          {(['bought', 'sold'] as OrderTab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 13,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
                backgroundColor: tab === t ? '#E8521A' : 'transparent',
              }}
            >
              <Ionicons
                name={t === 'bought' ? 'bag-outline' : 'storefront-outline'}
                size={15}
                color={tab === t ? 'white' : '#6B5E50'}
              />
              <Text style={{
                fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14,
                color: tab === t ? 'white' : '#6B5E50',
              }}>
                {t === 'bought' ? 'Purchases' : 'Sales'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : activeOrders.length === 0 ? (
        <EmptyState mode={tab} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.label}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              tintColor="#E8521A" colors={['#E8521A']}
            />
          }
          renderItem={({ item: group }) => (
            <View>
              {/* Date header */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{
                  fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11,
                  color: '#6B5E50', textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  {group.label}
                </Text>
              </View>
              {/* Order cards */}
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {group.items.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    mode={tab}
                    onOpenChat={handleOpenChat}
                    onConfirmDelivery={handleConfirmDelivery}
                    onDispute={handleDispute}
                    confirmingDelivery={confirmingDelivery}
                  />
                ))}
              </View>
            </View>
          )}
        />
      )}

      {/* Dispute Reason Modal */}
      <Modal
        visible={showDisputeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 20, borderWidth: 1, borderColor: '#2A1F14', width: '100%', maxWidth: 360, padding: 20 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 8 }}>
              Dispute Order
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', marginBottom: 20 }}>
              Please select a reason for disputing this order:
            </Text>
            <View style={{ gap: 10 }}>
              {[
                'Product not received',
                'Product not as described',
                'Quality issues',
                'Other',
              ].map(reason => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => handleDisputeReason(reason)}
                  style={{
                    backgroundColor: '#0F0A06',
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#2A1F14',
                  }}
                >
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowDisputeModal(false)}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}