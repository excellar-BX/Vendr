import { useState, useCallback, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { RUNNER_GREEN, naira } from '../../components/runner/RunnerKit';
import { runnerApi, RunnerRun } from '../../lib/api';
import { onSocketEvent } from '../../lib/socket';
import { T, useTheme } from '../../constants/theme';

const NEXT_STEP: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  assigned: { label: 'Go to pickup', color: '#E8521A', icon: 'storefront' },
  picked_up: { label: 'Deliver to buyer', color: RUNNER_GREEN, icon: 'navigate' },
  in_transit: { label: 'On the way to buyer', color: RUNNER_GREEN, icon: 'bicycle' },
  delivered: { label: 'Delivered', color: T.ink3, icon: 'checkmark-done' },
};

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function RunCard({ run }: { run: RunnerRun }) {
  useTheme();
  const step = NEXT_STEP[run.status] ?? NEXT_STEP.assigned;
  const done = run.status === 'delivered';
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/runner-run/[id]', params: { id: run.id } })}
      activeOpacity={0.85}
      style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16, marginBottom: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${step.color}1A`, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Ionicons name={step.icon} size={13} color={step.color} />
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: step.color }}>{step.label}</Text>
        </View>
        <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: done ? T.ink2 : RUNNER_GREEN }}>{naira(run.delivery_fee)}</Text>
      </View>
      <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink, marginTop: 12 }}>
        {run.seller_name} → {run.buyer_name}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 13, color: T.ink3, marginTop: 3 }}>
        {run.status === 'assigned' ? run.pickup_address : run.dropoff_address}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: T.ink4 }}>
          {done ? `Delivered ${timeAgo(run.delivered_at)}` : `Accepted ${timeAgo(run.assigned_at)}`} · {run.trip_km} km
        </Text>
        {!done && <Ionicons name="chevron-forward" size={18} color={T.ink4} />}
      </View>
    </TouchableOpacity>
  );
}

export default function RunnerActiveScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [runs, setRuns] = useState<RunnerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(false);
    try {
      const { data } = await runnerApi.runs(scope);
      setRuns(data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onSocketEvent('connect', () => load()), [load]);

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.5 }}>My deliveries</Text>
        <View style={{ flexDirection: 'row', backgroundColor: T.surface2, borderRadius: 14, padding: 4 }}>
          {(['active', 'completed'] as const).map((s) => (
            <TouchableOpacity key={s} onPress={() => { setLoading(true); setScope(s); }}
              style={{ flex: 1, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: scope === s ? T.surface : 'transparent' }}>
              <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: scope === s ? T.ink : T.ink3 }}>{s === 'active' ? 'In progress' : 'History'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={RUNNER_GREEN} /></View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RunCard run={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RUNNER_GREEN} colors={[RUNNER_GREEN]} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 30 }}>
              <Ionicons name={error ? 'cloud-offline-outline' : scope === 'active' ? 'bicycle-outline' : 'receipt-outline'} size={40} color={T.ink4} />
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>
                {error ? "Couldn't load deliveries" : scope === 'active' ? 'No deliveries in progress' : 'No completed deliveries yet'}
              </Text>
              <Text style={{ fontSize: 13, color: T.ink3, textAlign: 'center' }}>
                {error ? 'Pull down to try again.' : scope === 'active' ? 'Accept a job from the Jobs tab to get started.' : 'Your finished runs will show up here.'}
              </Text>
              {!error && scope === 'active' && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/runner-jobs')} style={{ marginTop: 8, backgroundColor: RUNNER_GREEN, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Find jobs</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}
