import { useState, useCallback, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Image,
} from 'react-native';
import { Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../components/ui/StyledText';
import { orderApi, disputeApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { uploadFile } from '../lib/storage';
import { useVendrAlert } from '../components/ui/VendrAlert';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type OrderTab = 'bought' | 'sold';

interface Order {
  id: string;
  amount: number;
  description: string | null;
  status: string;
  escrow_status: string;
  order_type: 'pickup' | 'delivery';
  delivery_address: string | null;
  otp_confirmed: boolean;
  buyer_confirmed_at: string | null;
  otp_confirmed_at: string | null;
  auto_release_at: string | null;
  created_at: string;
  buyer_id: string;
  vendor_id?: string;
  conversation_id: string | null;
  vendor_name?: string;
  buyer_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  completed: { label: 'Completed', color: '#2D8653', icon: 'checkmark-circle-outline' },
  refunded: { label: 'Refunded', color: '#5599E8', icon: 'refresh-circle-outline' },
  disputed: { label: 'Disputed', color: '#E85555', icon: 'alert-circle-outline' },
  pending: { label: 'Pending', color: '#F5A623', icon: 'time-outline' },
};

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(orders: Order[]) {
  const groups: { label: string; items: Order[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  orders.forEach((o) => {
    const d = new Date(o.created_at).toDateString();
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : formatDate(o.created_at);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(o);
    else groups.push({ label, items: [o] });
  });
  return groups;
}

function OrderCard({
  order,
  mode,
  onOpenChat,
  onConfirmPickup,
  onShowDeliveryCode,
  onVerifyOtp,
  onDispute,
  actionLoading,
  deliveryCode,
}: {
  order: Order;
  mode: OrderTab;
  onOpenChat: (id: string) => void;
  onConfirmPickup: (id: string) => void;
  onShowDeliveryCode: (order: Order) => void;
  onVerifyOtp: (order: Order) => void;
  onDispute: (order: Order) => void;
  actionLoading: string | null;
  deliveryCode: string | null;
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const isBought = mode === 'bought';
  const isHeld = order.escrow_status === 'held';
  const isPickup = order.order_type === 'pickup';
  const isDelivery = order.order_type === 'delivery';

  const showPickupConfirm =
    isBought && isHeld && isPickup && !order.buyer_confirmed_at;
  const showDeliveryCode =
    isBought && isHeld && isDelivery && !order.otp_confirmed;
  const showVendorOtpEntry =
    !isBought && isHeld && isDelivery && !order.otp_confirmed;
  const showDispute = isBought && isHeld;

  const escrowHint = (() => {
    if (order.escrow_status === 'disputed') return 'Under review — funds held until resolved';
    if (!isHeld) return null;
    if (isPickup && order.buyer_confirmed_at) return 'Receipt confirmed — payment released to vendor';
    if (isDelivery && order.otp_confirmed) return 'Delivery verified — payment releases after hold period';
    if (isDelivery) return 'Share your delivery code with the rider at handoff';
    return 'Payment held in escrow until you confirm receipt';
  })();

  return (
    <View style={{
      backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
      borderRadius: 20, padding: 16, gap: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }}>
            {isBought ? order.vendor_name : order.buyer_name ?? 'A buyer'}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            {isPickup ? 'Pickup' : 'Delivery'} · {formatTime(order.created_at)}
          </Text>
        </View>
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

      {escrowHint ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: 'rgba(45,134,83,0.1)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.2)',
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        }}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#2D8653" />
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#2D8653', flex: 1 }}>
            {escrowHint}
          </Text>
        </View>
      ) : null}

      {/* Auto-release countdown */}
      {order.escrow_status === 'held' && order.auto_release_at ? (
        (() => {
          const now = new Date();
          const releaseAt = new Date(order.auto_release_at);
          const diffMs = releaseAt.getTime() - now.getTime();
          if (diffMs <= 0) return null; // already passed, handled by backend
          const diffMin = Math.floor(diffMs / 60000);
          const hours = Math.floor(diffMin / 60);
          const minutes = diffMin % 60;
          const timeLeft = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          return (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(255,165,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,165,0,0.2)',
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
            }}>
              <Ionicons name="timer-outline" size={12} color="#FFA500" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#FFA500', flex: 1 }}>
                Auto‑releases in {timeLeft}
              </Text>
            </View>
          );
        })()
      ) : null}

      {isDelivery && order.delivery_address ? (
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>
          {order.delivery_address}
        </Text>
      ) : null}

      {showDeliveryCode && deliveryCode ? (
        <View style={{
          backgroundColor: '#0F0A06', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8521A40',
          alignItems: 'center', gap: 4,
        }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }}>
            Your delivery code
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#E8521A', letterSpacing: 8 }}>
            {deliveryCode}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#6B5E50', textAlign: 'center' }}>
            Tell this to the rider at delivery. Do not share before then.
          </Text>
        </View>
      ) : null}

      {order.description ? (
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 18 }}>
          {order.description}
        </Text>
      ) : null}

      <View style={{ height: 1, backgroundColor: '#2A1F14' }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{
          fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18,
          color: isBought ? '#E8521A' : '#2D8653',
        }}>
          {isBought ? '−' : '+'}{formatAmount(order.amount)}
        </Text>
        {order.conversation_id ? (
          <TouchableOpacity
            onPress={() => onOpenChat(order.conversation_id!)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
              backgroundColor: 'rgba(232,82,26,0.1)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.2)',
            }}
          >
            <Ionicons name="chatbubble-outline" size={14} color="#E8521A" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Chat</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {showPickupConfirm ? (
          <ActionBtn
            label={actionLoading === order.id ? 'Confirming...' : "I've received this"}
            icon="checkmark-circle"
            color="#2D8653"
            loading={actionLoading === order.id}
            onPress={() => onConfirmPickup(order.id)}
          />
        ) : null}
        {showDeliveryCode && !deliveryCode ? (
          <ActionBtn
            label="Show delivery code"
            icon="key-outline"
            color="#E8521A"
            loading={actionLoading === `otp-${order.id}`}
            onPress={() => onShowDeliveryCode(order)}
          />
        ) : null}
        {showVendorOtpEntry ? (
          <ActionBtn
            label="Enter delivery code"
            icon="keypad-outline"
            color="#2D8653"
            onPress={() => onVerifyOtp(order)}
          />
        ) : null}
        {showDispute ? (
          <ActionBtn
            label="Dispute"
            icon="alert-circle-outline"
            color="#E85555"
            onPress={() => onDispute(order)}
          />
        ) : null}
      </View>
    </View>
  );
}

function ActionBtn({
  label, icon, color, onPress, loading,
}: {
  label: string;
  icon: IoniconsName;
  color: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
        backgroundColor: color + '18', borderWidth: 1, borderColor: color + '40',
      }}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={14} color={color} />}
      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const { user, isVendor } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const [tab, setTab] = useState<OrderTab>('bought');
  const [boughtOrders, setBoughtOrders] = useState<Order[]>([]);
  const [soldOrders, setSoldOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({});

  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeEvidenceUri, setDisputeEvidenceUri] = useState<string | null>(null);
  const [disputeStep, setDisputeStep] = useState<'reason' | 'details'>('reason');

  const [otpModalOrder, setOtpModalOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState('');

  const userId = user?.id;
  const showTabs = isVendor;

  const fetchOrders = useCallback(async () => {
    if (!userId) return;
    try {
      const boughtRes = await orderApi.getOrders('bought');
      setBoughtOrders(boughtRes.data || []);
      if (isVendor) {
        const soldRes = await orderApi.getOrders('sold');
        setSoldOrders(soldRes.data || []);
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

  const handleConfirmPickup = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await orderApi.confirmDelivery(orderId);
      if (res.success) {
        showAlert({
          title: 'Confirmed',
          message: res.data?.message ?? 'Receipt confirmed.',
          type: 'success',
        });
        await fetchOrders();
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Could not confirm receipt', type: 'danger' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleShowDeliveryCode = async (order: Order) => {
    setActionLoading(`otp-${order.id}`);
    try {
      const res = await orderApi.getDeliveryOtp(order.id);
      if (res.data?.otp_code) {
        setDeliveryCodes((prev) => ({ ...prev, [order.id]: res.data.otp_code }));
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Could not load delivery code', type: 'danger' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpModalOrder || otpInput.length < 4) {
      showAlert({ title: 'Invalid code', message: 'Enter the 4-digit code from the buyer.', type: 'warning' });
      return;
    }
    setActionLoading(otpModalOrder.id);
    try {
      const res = await orderApi.verifyDeliveryOtp(otpModalOrder.id, otpInput.trim());
      if (res.success) {
        showAlert({
          title: 'Delivery verified',
          message: res.data?.message ?? 'Payment will release to the vendor after a short hold period.',
          type: 'success',
        });
        setOtpModalOrder(null);
        setOtpInput('');
        await fetchOrders();
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Invalid delivery code', type: 'danger' });
    } finally {
      setActionLoading(null);
    }
  };

  const needsEvidence =
    disputeOrder?.order_type === 'delivery' && disputeOrder?.otp_confirmed;

  const resetDispute = () => {
    setDisputeOrder(null);
    setDisputeReason('');
    setDisputeDescription('');
    setDisputeEvidenceUri(null);
    setDisputeStep('reason');
  };

  const submitDispute = async () => {
    if (!disputeOrder || !disputeReason) return;

    if (needsEvidence) {
      if (disputeDescription.trim().length < 20) {
        showAlert({ title: 'More detail needed', message: 'Please explain the issue in at least 20 characters.', type: 'warning' });
        return;
      }
      if (!disputeEvidenceUri) {
        showAlert({
          title: 'Photo required',
          message: 'Upload photo evidence when disputing after delivery was verified.',
          type: 'warning',
        });
        return;
      }
    }

    setActionLoading(`dispute-${disputeOrder.id}`);
    try {
      let evidence_urls: string[] = [];
      if (disputeEvidenceUri && userId) {
        const url = await uploadFile({
          bucket: 'chat-images',
          path: `${userId}/dispute_${disputeOrder.id}_${Date.now()}.jpg`,
          uri: disputeEvidenceUri,
          contentType: 'image/jpeg',
        });
        evidence_urls = [url];
      }

      await disputeApi.create({
        order_id: disputeOrder.id,
        reason: disputeReason,
        description: disputeDescription.trim() || undefined,
        evidence_urls,
      });

      showAlert({
        title: 'Dispute submitted',
        message: 'Our team will review your case. Funds stay in escrow until resolved.',
        type: 'success',
      });
      resetDispute();
      await fetchOrders();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Failed to submit dispute', type: 'danger' });
    } finally {
      setActionLoading(null);
    }
  };

  const pickEvidence = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({ title: 'Permission needed', message: 'Allow photo access to upload evidence.', type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setDisputeEvidenceUri(result.assets[0].uri);
    }
  };

  // Pre-load delivery codes for held delivery orders
  useEffect(() => {
    boughtOrders.forEach((o) => {
      if (
        o.order_type === 'delivery' &&
        o.escrow_status === 'held' &&
        !o.otp_confirmed &&
        !deliveryCodes[o.id]
      ) {
        orderApi.getDeliveryOtp(o.id).then((res) => {
          if (res.data?.otp_code) {
            setDeliveryCodes((prev) => ({ ...prev, [o.id]: res.data.otp_code }));
          }
        }).catch(() => {});
      }
    });
  }, [boughtOrders]);

  const activeOrders = tab === 'bought' ? boughtOrders : soldOrders;
  const groups = groupByDate(activeOrders);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      {alertElement}
      <StatusBar style="light" />

      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1208', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>Orders</Text>
        </View>
      </View>

      {showTabs && (
        <View style={{
          flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 4,
          backgroundColor: '#1A1208', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#2A1F14',
        }}>
          {(['bought', 'sold'] as OrderTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 13, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 6,
                backgroundColor: tab === t ? '#E8521A' : 'transparent',
              }}
            >
              <Ionicons name={t === 'bought' ? 'bag-outline' : 'storefront-outline'} size={15} color={tab === t ? 'white' : '#6B5E50'} />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: tab === t ? 'white' : '#6B5E50' }}>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 }}>
          <Ionicons name="bag-outline" size={30} color="#3D3026" />
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>No orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.label}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor="#E8521A" />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: group }) => (
            <View>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#6B5E50', textTransform: 'uppercase' }}>
                  {group.label}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {group.items.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    mode={tab}
                    onOpenChat={(id) => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: id } })}
                    onConfirmPickup={handleConfirmPickup}
                    onShowDeliveryCode={handleShowDeliveryCode}
                    onVerifyOtp={(o) => { setOtpModalOrder(o); setOtpInput(''); }}
                    onDispute={(o) => { setDisputeOrder(o); setDisputeStep('reason'); }}
                    actionLoading={actionLoading}
                    deliveryCode={deliveryCodes[order.id] ?? null}
                  />
                ))}
              </View>
            </View>
          )}
        />
      )}

      {/* Vendor OTP entry */}
      <Modal visible={!!otpModalOrder} transparent animationType="fade" onRequestClose={() => setOtpModalOrder(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2A1F14' }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 8 }}>
              Enter delivery code
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', marginBottom: 16 }}>
              Ask the buyer for their 4-digit code at handoff.
            </Text>
            <TextInput
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor="#6B5E50"
              style={{
                fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#FDF6EC',
                backgroundColor: '#0F0A06', borderRadius: 12, padding: 16, textAlign: 'center',
                letterSpacing: 12, borderWidth: 1, borderColor: '#2A1F14',
              }}
            />
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={actionLoading === otpModalOrder?.id}
              style={{ backgroundColor: '#2D8653', borderRadius: 14, padding: 14, marginTop: 16, alignItems: 'center' }}
            >
              {actionLoading === otpModalOrder?.id ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Verify delivery</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpModalOrder(null)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute modal */}
      <Modal visible={!!disputeOrder} transparent animationType="fade" onRequestClose={resetDispute}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2A1F14', maxHeight: '85%' }}>
            {disputeStep === 'reason' ? (
              <>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 8 }}>
                  Dispute order
                </Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', marginBottom: 16 }}>
                  Funds stay in escrow until our team reviews your case.
                </Text>
                {['Product not received', 'Product not as described', 'Quality issues', 'Other'].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => {
                      setDisputeReason(reason);
                      setDisputeStep('details');
                    }}
                    style={{
                      backgroundColor: '#0F0A06', borderRadius: 12, padding: 14,
                      borderWidth: 1, borderColor: '#2A1F14', marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>{reason}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', marginBottom: 4 }}>
                  {disputeReason}
                </Text>
                {needsEvidence ? (
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#E85555', marginBottom: 12 }}>
                    Delivery was verified with your code — photo evidence and a detailed explanation are required.
                  </Text>
                ) : null}
                <TextInput
                  value={disputeDescription}
                  onChangeText={setDisputeDescription}
                  placeholder="Describe what went wrong..."
                  placeholderTextColor="#6B5E50"
                  multiline
                  style={{
                    fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC',
                    backgroundColor: '#0F0A06', borderRadius: 12, padding: 12, minHeight: 100,
                    borderWidth: 1, borderColor: '#2A1F14', textAlignVertical: 'top', marginBottom: 12,
                  }}
                />
                {needsEvidence ? (
                  <TouchableOpacity
                    onPress={pickEvidence}
                    style={{
                      borderRadius: 12, borderWidth: 1, borderColor: '#2A1F14', borderStyle: 'dashed',
                      padding: 16, alignItems: 'center', marginBottom: 12,
                    }}
                  >
                    {disputeEvidenceUri ? (
                      <Image source={{ uri: disputeEvidenceUri }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={24} color="#9A8570" />
                        <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570', marginTop: 6 }}>
                          Add photo evidence
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={submitDispute}
                  disabled={!!actionLoading?.startsWith('dispute-')}
                  style={{ backgroundColor: '#E85555', borderRadius: 14, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Submit dispute</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDisputeStep('reason')} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={resetDispute} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#9A8570' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
