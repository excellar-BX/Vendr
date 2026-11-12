import { useState, useCallback, useEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, Switch, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { RUNNER_GREEN, naira, RunnerBanner } from '../../components/runner/RunnerKit';
import { runnerApi, RunnerJob, RunnerJobFilter } from '../../lib/api';
import { onSocketEvent } from '../../lib/socket';
import { useLocation } from '../../hooks/useLocation';
import { T, useTheme } from '../../constants/theme';

const FILTERS: { key: RunnerJobFilter; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'Newest', icon: 'time-outline' },
  { key: 'nearest', label: 'Nearest', icon: 'navigate-outline' },
  { key: 'highest_pay', label: 'Top pay', icon: 'cash-outline' },
  { key: 'fastest', label: 'Quickest', icon: 'flash-outline' },
];

interface Stats {
  status: string;
  is_online: boolean;
  within_schedule: boolean;
  active_runs: number;
  today_earnings: number;
  available_balance: number;
}

function JobCard({ job }: { job: RunnerJob }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/runner-job/[id]', params: { id: job.id } })}
      activeOpacity={0.85}
      style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16, marginBottom: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: RUNNER_GREEN, letterSpacing: -0.5 }}>{naira(job.delivery_fee)}</Text>
          <Text style={{ fontSize: 12, color: T.ink3, marginTop: 1 }}>{job.seller_name ? `From ${job.seller_name}` : 'Delivery job'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.surface2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Ionicons name="navigate" size={11} color={T.ink2} />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink2 }}>{job.to_pickup_km} km away</Text>
          </View>
          <Text style={{ fontSize: 11.5, color: T.ink3 }}>{job.trip_km} km trip · ~{job.estimated_time}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <View style={{ alignItems: 'center', paddingTop: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8521A' }} />
          <View style={{ width: 2, flex: 1, backgroundColor: T.line, marginVertical: 3 }} />
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: RUNNER_GREEN }} />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <View>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink4, letterSpacing: 0.6 }}>PICKUP</Text>
            <Text numberOfLines={1} style={{ fontSize: 14, color: T.ink, marginTop: 1 }}>{job.pickup_address}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink4, letterSpacing: 0.6 }}>DROP-OFF</Text>
            <Text numberOfLines={1} style={{ fontSize: 14, color: T.ink, marginTop: 1 }}>{job.dropoff_address}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RunnerJobsScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert, alertElement } = useVendrAlert();
  const { lat, lng } = useLocation();
  const locRef = useRef({ lat, lng });
  locRef.current = { lat, lng };

  const [filter, setFilter] = useState<RunnerJobFilter>('all');
  const [jobs, setJobs] = useState<RunnerJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notRunner, setNotRunner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(false);
    try {
      const [s, j] = await Promise.all([
        runnerApi.stats(),
        runnerApi.jobs({ filter, lat: locRef.current.lat, lng: locRef.current.lng, limit: 40 }),
      ]);
      setStats(s.data);
      setJobs(j.data ?? []);
      setNotRunner(false);
    } catch (e: any) {
      if (e?.statusCode === 404) setNotRunner(true);
      else setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live board: new jobs appear, jobs taken by others disappear
  useEffect(() => {
    const offs = [
      onSocketEvent('runner_job_new', () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        load();
      }),
      onSocketEvent('runner_job_taken', (d: { job_id: string }) => setJobs((prev) => prev.filter((j) => j.id !== d.job_id))),
      onSocketEvent('connect', () => load()),
    ];
    return () => offs.forEach((off) => off());
  }, [load]);

  const toggleOnline = async (next: boolean) => {
    if (!stats) return;
    setToggling(true);
    setStats({ ...stats, is_online: next });
    try {
      await runnerApi.setOnline(next);
      Haptics.selectionAsync().catch(() => {});
      load();
    } catch (e: any) {
      setStats({ ...stats, is_online: !next });
      showAlert({ title: "Couldn't change status", message: e?.message ?? 'Please try again.', type: 'warning' });
    } finally {
      setToggling(false);
    }
  };

  if (notRunner) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 10 }}>
        <StatusBar style={T.statusBar} />
        <Ionicons name="bicycle-outline" size={44} color={RUNNER_GREEN} />
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Become a runner first</Text>
        <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center' }}>Sign up to start earning from deliveries near you.</Text>
        <TouchableOpacity onPress={() => router.push('/become-runner')} style={{ marginTop: 6, backgroundColor: RUNNER_GREEN, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Sign up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pending = stats?.status === 'pending';
  const online = !!stats?.is_online;

  const header = (
    <View style={{ gap: 14, marginBottom: 14 }}>
      {/* Online card */}
      <View style={{ backgroundColor: online ? RUNNER_GREEN : T.heroBg, borderRadius: 22, padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? '#BBF7D0' : 'rgba(255,255,255,0.4)' }} />
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{online ? "You're online" : "You're offline"}</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              {online ? 'New jobs near you show up here instantly' : 'Go online to accept jobs'}
            </Text>
          </View>
          {toggling ? <ActivityIndicator color="#FFFFFF" /> : (
            <Switch
              value={online}
              onValueChange={toggleOnline}
              disabled={!stats || pending}
              trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#86EFAC' }}
              thumbColor="#FFFFFF"
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Today', value: naira(stats?.today_earnings ?? 0) },
            { label: 'Active', value: String(stats?.active_runs ?? 0), onPress: () => router.push('/(tabs)/runner-active') },
            { label: 'Withdrawable', value: naira(stats?.available_balance ?? 0), onPress: () => router.push('/(tabs)/runner-earnings') },
          ].map((s) => (
            <TouchableOpacity key={s.label} disabled={!s.onPress} onPress={s.onPress} activeOpacity={0.8} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 10 }}>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{s.value}</Text>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)' }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {pending && (
        <RunnerBanner tone="warn" icon="hourglass-outline" title="Your account is under review"
          body="We're checking your details. You'll get a notification once you're approved to take jobs." />
      )}
      {!pending && online && stats && !stats.within_schedule && (
        <RunnerBanner tone="info" icon="time-outline" title="Outside your usual hours"
          body="You're online, so you'll still see jobs. Update your hours anytime from your runner profile." />
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: active ? T.ink : T.line, backgroundColor: active ? T.ink : T.surface }}>
              <Ionicons name={f.icon} size={13} color={active ? T.canvas : T.ink3} />
              <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: active ? T.canvas : T.ink2 }}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 10 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.5 }}>Delivery jobs</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={RUNNER_GREEN} /></View>
      ) : (
        <FlatList
          data={online && !pending ? jobs : []}
          keyExtractor={(j) => j.id}
          renderItem={({ item }) => <JobCard job={item} />}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RUNNER_GREEN} colors={[RUNNER_GREEN]} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Ionicons name={error ? 'cloud-offline-outline' : !online ? 'moon-outline' : 'cube-outline'} size={38} color={T.ink4} />
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>
                {error ? "Couldn't load jobs" : pending ? 'Waiting for approval' : !online ? 'Go online to see jobs' : 'No jobs nearby right now'}
              </Text>
              <Text style={{ fontSize: 13, color: T.ink3, textAlign: 'center', paddingHorizontal: 30 }}>
                {error ? 'Pull down to try again.' : online ? "Stay online — we'll buzz you when an order near you needs delivering." : 'Flip the switch above when you’re ready to work.'}
              </Text>
            </View>
          }
        />
      )}
      {alertElement}
    </View>
  );
}
