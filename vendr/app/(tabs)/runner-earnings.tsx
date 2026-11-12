import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { RUNNER_GREEN, naira } from '../../components/runner/RunnerKit';
import { runnerApi } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

type Filter = 'today' | 'week' | 'month' | 'all';
interface Earning { id: string; run_id: string; amount: number; status: 'pending' | 'available' | 'paid'; completed_at: string; paid_at: string | null }
interface Balance { available: number; pending: number; paid: number; total: number }

const STATUS_META: Record<Earning['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#B45309', bg: '#FEF5E5' },
  available: { label: 'Ready', color: '#2D8653', bg: '#EAF5EE' },
  paid: { label: 'In wallet', color: '#57534E', bg: '#F5F5F4' },
};

export default function RunnerEarningsScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert, alertElement } = useVendrAlert();
  const [filter, setFilter] = useState<Filter>('week');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [b, e] = await Promise.all([runnerApi.balance(), runnerApi.earnings(filter)]);
      setBalance(b.data);
      setEarnings(e.data ?? []);
    } catch {
      // keep what we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const withdraw = () => {
    if (!balance || balance.available <= 0) return;
    showAlert({
      title: `Move ${naira(balance.available)} to your wallet?`,
      message: 'It lands in your Vendr wallet instantly. From there you can send it to your bank.',
      type: 'question',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to wallet', onPress: async () => {
            setWithdrawing(true);
            try {
              const { data } = await runnerApi.withdraw();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showAlert({
                title: 'Done!', message: `${naira(data?.amount ?? 0)} is now in your wallet.`, type: 'success',
                buttons: [{ text: 'Open wallet', onPress: () => router.push('/wallet') }, { text: 'OK', style: 'cancel' }],
              });
              load();
            } catch (e: any) {
              showAlert({ title: "Couldn't withdraw", message: e?.message ?? 'Please try again.', type: 'danger' });
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ],
    });
  };

  const periodTotal = earnings.reduce((s, e) => s + e.amount, 0);

  const header = (
    <View style={{ gap: 14, marginBottom: 12 }}>
      <View style={{ backgroundColor: T.heroBg, borderRadius: 24, padding: 20, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(45,134,83,0.35)', right: -50, top: -70 }} />
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Ready to withdraw</Text>
        <Text style={{ fontSize: 36, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.8 }}>{naira(balance?.available ?? 0)}</Text>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FDE68A' }}>{naira(balance?.pending ?? 0)}</Text>
            <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)' }}>Pending</Text>
          </View>
          <View>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{naira(balance?.total ?? 0)}</Text>
            <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)' }}>All-time</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={withdraw}
          disabled={withdrawing || !balance || balance.available <= 0}
          style={{ marginTop: 16, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: balance && balance.available > 0 ? RUNNER_GREEN : 'rgba(255,255,255,0.12)' }}
        >
          {withdrawing ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Ionicons name="wallet" size={17} color="#FFFFFF" />
              <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Move to wallet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Ionicons name="information-circle-outline" size={15} color={T.ink3} />
        <Text style={{ flex: 1, fontSize: 12, color: T.ink3, lineHeight: 17 }}>
          Fees are pending until the order settles (about 2 hours after delivery), then they're ready to withdraw.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['today', 'week', 'month', 'all'] as Filter[]).map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: filter === f ? T.ink : T.line, backgroundColor: filter === f ? T.ink : T.surface }}>
              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: filter === f ? T.canvas : T.ink2 }}>
                {f === 'today' ? 'Today' : f === 'week' ? '7 days' : f === 'month' ? '30 days' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{naira(periodTotal)}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.5 }}>Earnings</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={RUNNER_GREEN} /></View>
      ) : (
        <FlatList
          data={earnings}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RUNNER_GREEN} colors={[RUNNER_GREEN]} />}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.pending;
            return (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/runner-run/[id]', params: { id: item.run_id } })}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${RUNNER_GREEN}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="bicycle" size={19} color={RUNNER_GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink }}>Delivery fee</Text>
                  <Text style={{ fontSize: 12, color: T.ink3 }}>{new Date(item.completed_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>+{naira(item.amount)}</Text>
                  <View style={{ backgroundColor: meta.bg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: meta.color }}>{meta.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Ionicons name="cash-outline" size={38} color={T.ink4} />
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>No earnings in this period</Text>
              <Text style={{ fontSize: 13, color: T.ink3 }}>Complete deliveries to start earning.</Text>
            </View>
          }
        />
      )}
      {alertElement}
    </View>
  );
}
