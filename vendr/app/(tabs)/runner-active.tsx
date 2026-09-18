import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type RunStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered';

interface ActiveRun {
  id: string;
  order_id: string;
  pickup_address: string;
  dropoff_address: string;
  seller_name: string;
  buyer_name: string;
  delivery_fee: number;
  status: RunStatus;
  assigned_at: string;
  picked_up_at?: string;
  estimated_delivery: string;
}

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; icon: IoniconsName }> = {
  assigned: { label: 'Assigned', color: '#F5A623', icon: 'person-outline' },
  picked_up: { label: 'Picked Up', color: '#2D8653', icon: 'cube-outline' },
  in_transit: { label: 'In Transit', color: '#5599E8', icon: 'bicycle-outline' },
  delivered: { label: 'Delivered', color: '#9A8570', icon: 'checkmark-circle-outline' },
};

function ActiveRunCard({ run }: { run: ActiveRun }) {
  const status = STATUS_CONFIG[run.status];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/runner-run/${run.id}`)}
      activeOpacity={0.85}
      className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-3"
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center gap-2">
          <View className={`w-8 h-8 rounded-full items-center justify-center`} style={{ backgroundColor: `${status.color}20` }}>
            <Ionicons name={status.icon} size={16} color={status.color} />
          </View>
          <View>
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Order #{run.order_id.slice(-6)}
            </Text>
            <Text className="text-muted text-xs">{status.label}</Text>
          </View>
        </View>
        <View className="bg-green-500/20 px-2 py-1 rounded-lg">
          <Text className="text-green-500 text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            ₦{run.delivery_fee.toLocaleString()}
          </Text>
        </View>
      </View>

      <View className="gap-3 mb-3">
        <View className="flex-row items-start gap-3">
          <View className="mt-1">
            <View className="w-2 h-2 bg-orange rounded-full" />
            <View className="w-0.5 h-8 bg-faint ml-1" />
            <View className="w-2 h-2 bg-green-500 rounded-full mt-1" />
          </View>
          <View className="flex-1">
            <View className="mb-3">
              <Text className="text-muted text-xs mb-1">FROM</Text>
              <Text className="text-cream text-sm" numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                {run.seller_name}
              </Text>
              <Text className="text-muted text-xs">{run.pickup_address}</Text>
            </View>
            <View>
              <Text className="text-muted text-xs mb-1">TO</Text>
              <Text className="text-cream text-sm" numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                {run.buyer_name}
              </Text>
              <Text className="text-muted text-xs">{run.dropoff_address}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-faint">
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={14} color="#9A8570" />
          <Text className="text-muted text-xs">ETA: {run.estimated_delivery}</Text>
        </View>
        <TouchableOpacity className="bg-green-500/20 px-3 py-1.5 rounded-lg">
          <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            Track
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function RunnerActiveScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [loading, setLoading] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch active runs from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Mock data - replace with API call
  const mockRuns: ActiveRun[] = [
    {
      id: '1',
      order_id: 'ORD-1234567890',
      pickup_address: '12 Adetokunbo Ademola Street, Victoria Island',
      dropoff_address: '45 Awolowo Road, Ikoyi',
      seller_name: 'Chike Electronics',
      buyer_name: 'Tunde Bakare',
      delivery_fee: 2500,
      status: 'picked_up',
      assigned_at: new Date(Date.now() - 15 * 60000).toISOString(),
      picked_up_at: new Date(Date.now() - 5 * 60000).toISOString(),
      estimated_delivery: '10 min',
    },
  ];

  useEffect(() => {
    setActiveRuns(mockRuns);
    setLoading(false);
  }, []);

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Active</Text>
        <View className="bg-green-500/20 px-3 py-1 rounded-full">
          <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            {activeRuns.length} Active
          </Text>
        </View>
      </View>

      {/* Active Runs List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2D8653" />
        </View>
      ) : activeRuns.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="bicycle-outline" size={48} color="#3D3026" />
          <Text className="text-cream text-lg mt-4" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            No active deliveries
          </Text>
          <Text className="text-muted text-sm mt-2 text-center">
            Go to Jobs tab to find delivery opportunities
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8653" />
          }
        >
          {activeRuns.map((run) => (
            <ActiveRunCard key={run.id} run={run} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
