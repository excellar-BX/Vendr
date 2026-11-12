import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Text } from '../../components/ui/StyledText';
import { RUNNER_GREEN, naira, openDirections, callPhone, CodeSheet } from '../../components/runner/RunnerKit';
import { runnerApi, RunnerRun } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

const STEPS = [
  { key: 'assigned', label: 'Pick up' },
  { key: 'picked_up', label: 'Collected' },
  { key: 'in_transit', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
] as const;

/** A delivery in progress: guided pickup → drop-off with the seller's and buyer's codes. */
export default function RunScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState<RunnerRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'pickup' | 'delivery' | null>(null);
  const [justDelivered, setJustDelivered] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (isRefresh) setRefreshing(true);
    try {
      const { data } = await runnerApi.run(id);
      setRun(data);
      setError(null);
    } catch (e: any) {
      setError(e?.statusCode === 403 ? 'This delivery belongs to another runner.' : e?.statusCode === 404 ? 'Delivery not found.' : "Couldn't load this delivery.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/runner-active'));

  const confirmPickup = async (code: string) => {
    if (!run?.order_id) throw new Error('This delivery has no order attached.');
    const { data } = await runnerApi.confirmPickup(run.order_id, code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRun(data);
    setSheet(null);
  };

  const confirmDelivery = async (code: string) => {
    if (!run?.order_id) throw new Error('This delivery has no order attached.');
    await runnerApi.confirmDelivery(run.order_id, code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSheet(null);
    setJustDelivered(true);
    load();
  };

  // Heading to the buyer marks the run "on the way" (buyer sees it move)
  const navigateToBuyer = async () => {
    if (!run) return;
    openDirections(run.dropoff_lat, run.dropoff_lng, run.dropoff_address);
    if (run.status === 'picked_up') {
      try { const { data } = await runnerApi.startDelivery(run.id); setRun(data); } catch {}
    }
  };

  if (loading || !run) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 }}>
        <StatusBar style={T.statusBar} />
        {loading ? <ActivityIndicator color={RUNNER_GREEN} /> : (
          <>
            <Ionicons name="alert-circle-outline" size={40} color={T.ink4} />
            <Text style={{ fontSize: 15, color: T.ink, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity onPress={goBack} style={{ backgroundColor: RUNNER_GREEN, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === run.status);
  const delivered = run.status === 'delivered';
  const atPickupStage = run.status === 'assigned';

  // ── Delivered ─────────────────────────────────────────────────────────────
  if (delivered) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <StatusBar style={T.statusBar} />
        <Animated.View entering={justDelivered ? ZoomIn.springify().damping(10) : undefined}
          style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: `${RUNNER_GREEN}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={64} color={RUNNER_GREEN} />
        </Animated.View>
        <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>Delivered!</Text>
        <Text style={{ fontSize: 15, color: T.ink2, textAlign: 'center' }}>
          You earned <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: RUNNER_GREEN }}>{naira(run.delivery_fee)}</Text>
        </Text>
        <Text style={{ fontSize: 13, color: T.ink3, textAlign: 'center', lineHeight: 19 }}>
          It shows as pending in Earnings and becomes withdrawable once the order settles (about 2 hours).
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' }}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/runner-earnings')} style={{ flex: 1, height: 52, borderRadius: 16, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink2 }}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/runner-jobs')} style={{ flex: 1.3, height: 52, borderRadius: 16, backgroundColor: RUNNER_GREEN, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Find next job</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const Party = ({ role, name, phone, address, lat, lng, onNavigate, color }: {
    role: string; name: string; phone: string | null; address: string; lat: number; lng: number; onNavigate: () => void; color: string;
  }) => (
    <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color }}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink4, letterSpacing: 0.6 }}>{role}</Text>
          <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{name}</Text>
        </View>
        {!!phone && (
          <TouchableOpacity onPress={() => callPhone(phone)} accessibilityLabel={`Call ${role.toLowerCase()}`}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="call" size={17} color={RUNNER_GREEN} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={{ fontSize: 13.5, color: T.ink2, marginTop: 10, lineHeight: 19 }}>{address}</Text>
      <TouchableOpacity onPress={onNavigate} style={{ marginTop: 12, height: 44, borderRadius: 14, backgroundColor: T.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="navigate" size={16} color={RUNNER_GREEN} />
        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 8 }}>
        <TouchableOpacity onPress={goBack} accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Delivery</Text>
          <Text style={{ fontSize: 12, color: T.ink3 }}>Order #{(run.order_id ?? run.id).slice(0, 8).toUpperCase()} · {naira(run.delivery_fee)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 130, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RUNNER_GREEN} colors={[RUNNER_GREEN]} />}
      >
        {/* Progress */}
        <View style={{ flexDirection: 'row', backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 14 }}>
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= stepIndex ? RUNNER_GREEN : T.line }} />
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? RUNNER_GREEN : current ? `${RUNNER_GREEN}2E` : T.surface2, borderWidth: current ? 2 : 0, borderColor: RUNNER_GREEN }}>
                    {done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: current ? RUNNER_GREEN : T.ink4 }}>{i + 1}</Text>}
                  </View>
                  <View style={{ flex: 1, height: 2, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < stepIndex ? RUNNER_GREEN : T.line }} />
                </View>
                <Text style={{ fontSize: 11, marginTop: 6, fontFamily: current ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', color: current ? T.ink : T.ink3 }}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {/* What to do now */}
        <View style={{ backgroundColor: atPickupStage ? '#FFF1EA' : `${RUNNER_GREEN}14`, borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10 }}>
          <Ionicons name={atPickupStage ? 'storefront' : 'person'} size={20} color={atPickupStage ? '#C2410C' : RUNNER_GREEN} />
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: atPickupStage ? '#9A3412' : T.ink }}>
            {atPickupStage
              ? `Go to ${run.seller_name}. When you collect the order, ask the seller for their 6-digit pickup code.`
              : `Take the order to ${run.buyer_name}. At the door, ask for their delivery code (it's in their Orders page).`}
          </Text>
        </View>

        {atPickupStage ? (
          <Party role="SELLER" name={run.seller_name} phone={run.seller_phone} address={run.pickup_address} lat={run.pickup_lat} lng={run.pickup_lng} color="#E8521A"
            onNavigate={() => openDirections(run.pickup_lat, run.pickup_lng, run.pickup_address)} />
        ) : (
          <Party role="BUYER" name={run.buyer_name} phone={run.buyer_phone} address={run.dropoff_address} lat={run.dropoff_lat} lng={run.dropoff_lng} color={RUNNER_GREEN}
            onNavigate={navigateToBuyer} />
        )}

        {/* Items */}
        <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16 }}>
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 0.6, marginBottom: 6 }}>ITEMS</Text>
          {(run.items ?? []).map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
              <Text style={{ flex: 1, fontSize: 14, color: T.ink }}>{it.name}</Text>
              <Text style={{ fontSize: 13, color: T.ink3 }}>×{it.quantity}</Text>
            </View>
          ))}
          {!!run.special_instructions && <Text style={{ fontSize: 13, color: T.goldInk, marginTop: 6 }}>📝 {run.special_instructions}</Text>}
        </View>

        {/* The other stop, for reference */}
        <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Ionicons name={atPickupStage ? 'flag-outline' : 'storefront-outline'} size={18} color={T.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink4, letterSpacing: 0.6 }}>{atPickupStage ? `THEN DELIVER TO ${run.buyer_name.toUpperCase()}` : `PICKED UP FROM ${run.seller_name.toUpperCase()}`}</Text>
            <Text numberOfLines={2} style={{ fontSize: 13, color: T.ink2, marginTop: 2 }}>{atPickupStage ? run.dropoff_address : run.pickup_address}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Main action */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.canvas, borderTopWidth: 1, borderTopColor: T.line }}>
        <TouchableOpacity
          onPress={() => setSheet(atPickupStage ? 'pickup' : 'delivery')}
          style={{ height: 56, borderRadius: 18, backgroundColor: atPickupStage ? '#E8521A' : RUNNER_GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="keypad" size={19} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
            {atPickupStage ? 'Enter pickup code' : 'Enter delivery code'}
          </Text>
        </TouchableOpacity>
      </View>

      <CodeSheet
        visible={sheet === 'pickup'}
        title="Seller's pickup code"
        subtitle={`Ask ${run.seller_name} for the 6-digit code shown on their order.`}
        length={6}
        icon="storefront"
        onSubmit={confirmPickup}
        onClose={() => setSheet(null)}
      />
      <CodeSheet
        visible={sheet === 'delivery'}
        title="Buyer's delivery code"
        subtitle={`Ask ${run.buyer_name} for the 4-digit delivery code in their Orders page. Only enter it once they have the order.`}
        length={4}
        icon="person"
        onSubmit={confirmDelivery}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
