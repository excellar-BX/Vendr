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
import { orderApi, disputeApi, runnerApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { uploadFile } from '../lib/storage';
import { useVendrAlert } from '../components/ui/VendrAlert';
import { T, useTheme } from '../constants/theme';

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
  pending: { label: 'Pending', color: '#D97706', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#2D8653', icon: 'checkmark-circle-outline' },
  preparing: { label: 'Preparing', color: '#2563EB', icon: 'restaurant-outline' },
  ready: { label: 'Ready', color: '#7C3AED', icon: 'cube-outline' },
  delivered: { label: 'Delivered', color: '#27AE60', icon: 'checkmark-done-circle-outline' },
  cancelled: { label: 'Cancelled', color: '#DC2626', icon: 'close-circle-outline' },
  refunded: { label: 'Refunded', color: '#2563EB', icon: 'refresh-circle-outline' },
  disputed: { label: 'Disputed', color: '#DC2626', icon: 'alert-circle-outline' },
  completed: { label: 'Completed', color: '#2D8653', icon: 'checkmark-circle-outline' },
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

// Order status flow for tracking
const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];

function OrderStatusStepper({ status }: { status: string }) {
  useTheme();
  const currentIndex = STATUS_FLOW.indexOf(status);
  const isCancelled = status === 'cancelled';
  const isRefunded = status === 'refunded';
  const isDisputed = status === 'disputed';

  if (isCancelled || isRefunded || isDisputed) {
    return null; // Show special status badge instead
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      {STATUS_FLOW.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <View key={step} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: isCompleted ? '#2D8653' : isCurrent ? '#E8521A' : T.line,
                borderWidth: 2,
                borderColor: isCompleted ? '#2D8653' : isCurrent ? '#E8521A' : T.lineStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={12} color="white" />
              ) : (
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: isCurrent ? T.primaryInk : T.ink3 }}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_500Medium',
                fontSize: 9,
                color: isCompleted ? T.successInk : isCurrent ? T.primaryInk : T.ink3,
                marginTop: 4,
                textTransform: 'capitalize',
              }}
            >
              {step}
            </Text>
            {index < STATUS_FLOW.length - 1 && (
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  width: '100%',
                  height: 2,
                  backgroundColor: isCompleted ? '#2D8653' : T.line,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Seller-side: reveal the 6-digit code a runner enters when collecting the order. */
function RunnerPickupCode({ orderId }: { orderId: string }) {
  useTheme();
  const [state, setState] = useState<'idle' | 'loading' | 'shown' | 'none' | 'error'>('idle');
  const [code, setCode] = useState<string | null>(null);

  const reveal = async () => {
    setState('loading');
    try {
      const { data } = await runnerApi.sellerPickupCode(orderId);
      if (data?.qr_code && /^\d{6}$/.test(data.qr_code)) { setCode(data.qr_code); setState('shown'); }
      else setState('none'); // self-delivery (no runner job) or older order
    } catch {
      setState('error');
    }
  };

  if (state === 'none') return null;
  return (
    <TouchableOpacity
      onPress={state === 'shown' ? undefined : reveal}
      activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(232,82,26,0.08)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)' }}
    >
      <Ionicons name="bicycle" size={18} color="#E8521A" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: T.ink }}>Runner pickup code</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: T.ink3 }}>
          {state === 'shown' ? 'Read this to the runner when they collect the order' : state === 'error' ? "Couldn't load — tap to retry" : 'Tap to show the code for the runner'}
        </Text>
      </View>
      {state === 'loading' ? <ActivityIndicator size="small" color="#E8521A" /> : state === 'shown' ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: 3, color: '#C2410C' }}>{code}</Text>
      ) : (
        <Ionicons name="eye-outline" size={18} color="#E8521A" />
      )}
    </TouchableOpacity>
  );
}

function OrderCard({
  order,
  mode,
  onOpenChat,
  onConfirmPickup,
  onShowDeliveryCode,
  onVerifyOtp,
  onDispute,
  onUpdateStatus,
  onConfirmReceipt,
  onOpenStatusModal,
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
  onUpdateStatus: (orderId: string, status: string) => void;
  onConfirmReceipt: (orderId: string) => void;
  onOpenStatusModal: (order: Order) => void;
  actionLoading: string | null;
  deliveryCode: string | null;
}) {
  useTheme();
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const isBought = mode === 'bought';
  const isHeld = order.escrow_status === 'held';
  const isPickup = order.order_type === 'pickup';
  const isDelivery = order.order_type === 'delivery';

  // New order tracking logic
  const showBuyerConfirm = isBought && order.status === 'ready';
  const showVendorStatusUpdate = !isBought && ['pending', 'confirmed', 'preparing'].includes(order.status);

  // Legacy escrow logic (keep for backward compatibility)
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

  // Get next valid status for vendor
  const getNextStatus = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: [],
      delivered: [],
      cancelled: [],
    };
    return transitions[current] || [];
  };

  const nextStatuses = getNextStatus(order.status);

  return (
    <View style={{
      backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
      borderRadius: 20, padding: 16, gap: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.ink }}>
            {isBought ? order.vendor_name : order.buyer_name ?? 'A buyer'}
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3 }}>
            {isPickup ? 'Pickup' : 'Delivery'} · {formatTime(order.created_at)}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
          backgroundColor: cfg.color + '18', borderWidth: 1, borderColor: cfg.color + '30',
        }}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: cfg.color }}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {/* Order Status Stepper */}
      <OrderStatusStepper status={order.status} />

      {escrowHint ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: 'rgba(45,134,83,0.1)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.2)',
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        }}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#2D8653" />
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.successInk, flex: 1 }}>
            {escrowHint}
          </Text>
        </View>
      ) : null}

      {/* Seller: code the runner needs at pickup (only for runner-delivered orders) */}
      {!isBought && isDelivery && isHeld && !order.otp_confirmed && !['in_transit', 'delivered', 'completed', 'cancelled'].includes(order.status) ? (
        <RunnerPickupCode orderId={order.id} />
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
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.goldInk, flex: 1 }}>
                Auto‑releases in {timeLeft}
              </Text>
            </View>
          );
        })()
      ) : null}

      {isDelivery && order.delivery_address ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink2 }}>
          {order.delivery_address}
        </Text>
      ) : null}

      {showDeliveryCode && deliveryCode ? (
        <View style={{
          backgroundColor: T.canvas, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8521A40',
          alignItems: 'center', gap: 4,
        }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink2 }}>
            Your delivery code
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: T.primaryInk, letterSpacing: 8 }}>
            {deliveryCode}
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: T.ink3, textAlign: 'center' }}>
            Tell this to the rider at delivery. Do not share before then.
          </Text>
        </View>
      ) : null}

      {order.description ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, lineHeight: 18 }}>
          {order.description}
        </Text>
      ) : null}

      <View style={{ height: 1, backgroundColor: T.line }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{
          fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18,
          color: isBought ? T.primaryInk : T.successInk,
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
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: T.primaryInk }}>Chat</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {/* New order tracking actions */}
        {showBuyerConfirm ? (
          <ActionBtn
            label={actionLoading === order.id ? 'Confirming...' : 'Confirm Receipt'}
            icon="checkmark-circle"
            color="#2D8653"
            loading={actionLoading === order.id}
            onPress={() => onConfirmReceipt(order.id)}
          />
        ) : null}
        {showVendorStatusUpdate ? (
          <ActionBtn
            label="Update Status"
            icon="arrow-down-circle-outline"
            color="#E8521A"
            onPress={() => onOpenStatusModal(order)}
          />
        ) : null}

        {/* Legacy escrow actions */}
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
            color="#DC2626"
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
  useTheme();
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
      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  useTheme();
  const { user, isVendor } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const [tab, setTab] = useState<OrderTab>('bought');
  const [boughtOrders, setBoughtOrders] = useState<Order[]>([]);
  const [soldOrders, setSoldOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({});

  // Status update modal
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);

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

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setActionLoading(`${orderId}-${status}`);
    try {
      const res = await orderApi.updateStatus(orderId, status);
      if (res.success) {
        showAlert({
          title: 'Status updated',
          message: `Order marked as ${STATUS_CONFIG[status]?.label || status}`,
          type: 'success',
        });
        await fetchOrders();
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Could not update order status', type: 'danger' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await orderApi.confirmReceipt(orderId);
      if (res.success) {
        showAlert({
          title: 'Order confirmed',
          message: 'You have confirmed receipt of this order',
          type: 'success',
        });
        await fetchOrders();
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Could not confirm order receipt', type: 'danger' });
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
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      {alertElement}
      <StatusBar style={T.statusBar} />

      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: T.line, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: T.ink }}>Orders</Text>
        </View>
      </View>

      {showTabs && (
        <View style={{
          flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 4,
          backgroundColor: T.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: T.line,
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
              <Ionicons name={t === 'bought' ? 'bag-outline' : 'storefront-outline'} size={15} color={tab === t ? 'white' : T.ink3} />
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: tab === t ? 'white' : T.ink3 }}>
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
          <Ionicons name="bag-outline" size={30} color={T.ink4} />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink }}>No orders yet</Text>
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
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: T.ink3, textTransform: 'uppercase' }}>
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
                    onUpdateStatus={handleUpdateStatus}
                    onConfirmReceipt={handleConfirmReceipt}
                    onOpenStatusModal={(o) => setStatusModalOrder(o)}
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
          <View style={{ backgroundColor: T.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, marginBottom: 8 }}>
              Enter delivery code
            </Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3, marginBottom: 16 }}>
              Ask the buyer for their 4-digit code at handoff.
            </Text>
            <TextInput
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={T.ink3}
              style={{
                fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: T.ink,
                backgroundColor: T.canvas, borderRadius: 12, padding: 16, textAlign: 'center',
                letterSpacing: 12, borderWidth: 1, borderColor: T.line,
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
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>Verify delivery</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpModalOrder(null)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink2 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Update Modal */}
      <Modal visible={!!statusModalOrder} transparent animationType="slide" onRequestClose={() => setStatusModalOrder(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setStatusModalOrder(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: T.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 32,
              borderWidth: 1,
              borderColor: T.line,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: T.ink }}>
                Update Order Status
              </Text>
              <TouchableOpacity onPress={() => setStatusModalOrder(null)}>
                <Ionicons name="close" size={24} color={T.ink3} />
              </TouchableOpacity>
            </View>

            {statusModalOrder && (
              <>
                <View style={{ backgroundColor: T.canvas, borderRadius: 16, padding: 16, marginBottom: 20 }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3, marginBottom: 4 }}>
                    Current Status
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={STATUS_CONFIG[statusModalOrder.status]?.icon || 'time-outline'}
                      size={20}
                      color={STATUS_CONFIG[statusModalOrder.status]?.color || '#F5A623'}
                    />
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: T.ink }}>
                      {STATUS_CONFIG[statusModalOrder.status]?.label || statusModalOrder.status}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink2, marginBottom: 12 }}>
                  Select new status
                </Text>

                <View style={{ gap: 12 }}>
                  {(() => {
                    const transitions: Record<string, string[]> = {
                      pending: ['confirmed', 'cancelled'],
                      confirmed: ['preparing', 'cancelled'],
                      preparing: ['ready', 'cancelled'],
                      ready: [],
                      delivered: [],
                      cancelled: [],
                    };
                    const availableStatuses = transitions[statusModalOrder.status] || [];

                    return availableStatuses.map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => {
                          handleUpdateStatus(statusModalOrder.id, status);
                          setStatusModalOrder(null);
                        }}
                        disabled={actionLoading === `${statusModalOrder.id}-${status}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          backgroundColor: T.canvas,
                          borderRadius: 16,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: T.line,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: `${STATUS_CONFIG[status]?.color || '#E8521A'}18`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name={STATUS_CONFIG[status]?.icon || 'arrow-forward'}
                            size={20}
                            color={STATUS_CONFIG[status]?.color || '#E8521A'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: T.ink }}>
                            {STATUS_CONFIG[status]?.label || status}
                          </Text>
                          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3, marginTop: 2 }}>
                            {status === 'confirmed' && 'Confirm the order and start processing'}
                            {status === 'preparing' && 'Order is being prepared'}
                            {status === 'ready' && 'Order is ready for pickup/delivery'}
                            {status === 'cancelled' && 'Cancel this order'}
                          </Text>
                        </View>
                        {actionLoading === `${statusModalOrder.id}-${status}` ? (
                          <ActivityIndicator size="small" color="#E8521A" />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={T.ink3} />
                        )}
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Dispute modal */}
      <Modal visible={!!disputeOrder} transparent animationType="fade" onRequestClose={resetDispute}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: T.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: T.line, maxHeight: '85%' }}>
            {disputeStep === 'reason' ? (
              <>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, marginBottom: 8 }}>
                  Dispute order
                </Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3, marginBottom: 16 }}>
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
                      backgroundColor: T.canvas, borderRadius: 12, padding: 14,
                      borderWidth: 1, borderColor: T.line, marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: T.ink }}>{reason}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink, marginBottom: 4 }}>
                  {disputeReason}
                </Text>
                {needsEvidence ? (
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.dangerInk, marginBottom: 12 }}>
                    Delivery was verified with your code — photo evidence and a detailed explanation are required.
                  </Text>
                ) : null}
                <TextInput
                  value={disputeDescription}
                  onChangeText={setDisputeDescription}
                  placeholder="Describe what went wrong..."
                  placeholderTextColor={T.ink3}
                  multiline
                  style={{
                    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: T.ink,
                    backgroundColor: T.canvas, borderRadius: 12, padding: 12, minHeight: 100,
                    borderWidth: 1, borderColor: T.line, textAlignVertical: 'top', marginBottom: 12,
                  }}
                />
                {needsEvidence ? (
                  <TouchableOpacity
                    onPress={pickEvidence}
                    style={{
                      borderRadius: 12, borderWidth: 1, borderColor: T.line, borderStyle: 'dashed',
                      padding: 16, alignItems: 'center', marginBottom: 12,
                    }}
                  >
                    {disputeEvidenceUri ? (
                      <Image source={{ uri: disputeEvidenceUri }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={24} color={T.ink2} />
                        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: T.ink2, marginTop: 6 }}>
                          Add photo evidence
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={submitDispute}
                  disabled={!!actionLoading?.startsWith('dispute-')}
                  style={{ backgroundColor: '#DC2626', borderRadius: 14, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>Submit dispute</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDisputeStep('reason')} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink2 }}>Back</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={resetDispute} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink2 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
