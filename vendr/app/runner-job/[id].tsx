import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { RUNNER_GREEN, naira, openDirections } from '../../components/runner/RunnerKit';
import { runnerApi, RunnerJob } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

/** One open delivery job: route, pay, items — accept it or pass. */
export default function RunnerJobScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { showAlert, alertElement } = useVendrAlert();
  const [job, setJob] = useState<RunnerJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const { data } = await runnerApi.job(id);
      setJob(data);
      // Already mine? Go straight to the delivery
      if (data?.my_run_id) router.replace({ pathname: '/runner-run/[id]', params: { id: data.my_run_id } });
    } catch (e: any) {
      setError(e?.statusCode === 404 ? 'This job no longer exists.' : "Couldn't load this job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/runner-jobs'));

  const accept = async () => {
    if (!job) return;
    setAccepting(true);
    try {
      const { data: run } = await runnerApi.accept(job.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: '/runner-run/[id]', params: { id: run.id } });
    } catch (e: any) {
      showAlert({
        title: e?.statusCode === 409 ? 'Too slow 😅' : "Couldn't accept",
        message: e?.message ?? 'Please try again.',
        type: 'warning',
        buttons: [{ text: 'OK', onPress: e?.statusCode === 409 ? goBack : undefined }],
      });
    } finally {
      setAccepting(false);
    }
  };

  const Stop = ({ color, label, address, lat, lng, square }: { color: string; label: string; address: string; lat: number; lng: number; square?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 12, height: 12, borderRadius: square ? 3 : 6, backgroundColor: color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink4, letterSpacing: 0.6 }}>{label}</Text>
        <Text style={{ fontSize: 14.5, color: T.ink, marginTop: 1 }}>{address}</Text>
      </View>
      <TouchableOpacity onPress={() => openDirections(lat, lng, address)} accessibilityLabel={`Directions to ${label.toLowerCase()}`}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="navigate" size={17} color={RUNNER_GREEN} />
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
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Job details</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={RUNNER_GREEN} /></View>
      ) : !job ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 36 }}>
          <Ionicons name="alert-circle-outline" size={40} color={T.ink4} />
          <Text style={{ fontSize: 15, color: T.ink, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={goBack} style={{ backgroundColor: RUNNER_GREEN, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Back to jobs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }}>
            {/* Pay */}
            <View style={{ backgroundColor: RUNNER_GREEN, borderRadius: 22, padding: 20 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>You earn</Text>
              <Text style={{ fontSize: 36, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.8 }}>{naira(job.delivery_fee)}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                {[
                  ['navigate-outline', `${job.to_pickup_km} km to pickup`],
                  ['swap-horizontal', `${job.trip_km} km trip`],
                  ['time-outline', `~${job.estimated_time}`],
                ].map(([icon, label]) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={icon as any} size={13} color="rgba(255,255,255,0.85)" />
                    <Text style={{ fontSize: 12.5, color: '#FFFFFF' }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {!job.is_available && (
              <View style={{ padding: 12, borderRadius: 14, backgroundColor: T.dangerSoft }}>
                <Text style={{ fontSize: 13.5, color: T.dangerInk, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Another runner has already taken this job.</Text>
              </View>
            )}

            {/* Route */}
            <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16, gap: 14 }}>
              <Stop color="#E8521A" label={`PICKUP${job.seller_name ? ` · ${job.seller_name.toUpperCase()}` : ''}`} address={job.pickup_address} lat={job.pickup_lat} lng={job.pickup_lng} />
              <View style={{ height: 1, backgroundColor: T.line, marginLeft: 24 }} />
              <Stop color={RUNNER_GREEN} square label="DROP-OFF" address={job.dropoff_address} lat={job.dropoff_lat} lng={job.dropoff_lng} />
            </View>

            {/* Items */}
            <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16 }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 0.6, marginBottom: 8 }}>WHAT YOU'RE CARRYING</Text>
              {(job.items ?? []).map((it, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ flex: 1, fontSize: 14, color: T.ink }}>{it.name}</Text>
                  <Text style={{ fontSize: 13, color: T.ink3 }}>×{it.quantity}</Text>
                </View>
              ))}
              {!!job.special_instructions && (
                <View style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: T.goldSoft }}>
                  <Text style={{ fontSize: 13, color: T.goldInk }}>📝 {job.special_instructions}</Text>
                </View>
              )}
            </View>

            {/* How it works */}
            <View style={{ backgroundColor: T.surface, borderRadius: 20, borderWidth: 1, borderColor: T.line, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 0.6 }}>HOW IT WORKS</Text>
              {[
                ['1', 'Go to the seller and enter the 6-digit pickup code they give you.'],
                ['2', 'Take the order to the buyer.'],
                ['3', 'Enter the buyer’s delivery code to finish — your fee lands in Earnings.'],
              ].map(([n, t]) => (
                <View key={n} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${RUNNER_GREEN}1F`, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: RUNNER_GREEN }}>{n}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13.5, color: T.ink2, lineHeight: 19 }}>{t}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {job.is_available && (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: T.canvas, borderTopWidth: 1, borderTopColor: T.line }}>
              <TouchableOpacity onPress={goBack} style={{ height: 54, paddingHorizontal: 22, borderRadius: 16, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={accept} disabled={accepting} style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: RUNNER_GREEN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                {accepting ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>Accept · {naira(job.delivery_fee)}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      {alertElement}
    </View>
  );
}
