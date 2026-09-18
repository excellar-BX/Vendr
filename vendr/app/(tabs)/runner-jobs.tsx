import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useLocation } from '../../hooks/useLocation';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface DeliveryJob {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  delivery_fee: number;
  distance_km: number;
  estimated_time: string;
  seller_name: string;
  seller_avatar?: string;
  items_count: number;
  created_at: string;
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Nearest', value: 'nearest' },
  { label: 'Highest Pay', value: 'highest_pay' },
  { label: 'Fastest', value: 'fastest' },
];

function JobCard({ job }: { job: DeliveryJob }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/runner-job/${job.id}`)}
      activeOpacity={0.85}
      className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-3"
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-orange/20 rounded-full items-center justify-center">
            <Text className="text-orange text-xs" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              {job.seller_name.charAt(0)}
            </Text>
          </View>
          <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            {job.seller_name}
          </Text>
        </View>
        <View className="bg-green-500/20 px-2 py-1 rounded-lg">
          <Text className="text-green-500 text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            ₦{job.delivery_fee.toLocaleString()}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row items-start gap-3">
          <View className="mt-1">
            <View className="w-2 h-2 bg-orange rounded-full" />
            <View className="w-0.5 h-8 bg-faint ml-1" />
            <View className="w-2 h-2 bg-green-500 rounded-full mt-1" />
          </View>
          <View className="flex-1">
            <View className="mb-3">
              <Text className="text-muted text-xs mb-1">PICKUP</Text>
              <Text className="text-cream text-sm" numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                {job.pickup_address}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs mb-1">DROPOFF</Text>
              <Text className="text-cream text-sm" numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
                {job.dropoff_address}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-4 mt-3 pt-3 border-t border-faint">
        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={14} color="#9A8570" />
          <Text className="text-muted text-xs">{job.distance_km.toFixed(1)} km</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={14} color="#9A8570" />
          <Text className="text-muted text-xs">{job.estimated_time}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="cube-outline" size={14} color="#9A8570" />
          <Text className="text-muted text-xs">{job.items_count} item{job.items_count > 1 ? 's' : ''}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RunnerJobsScreen() {
  const { lat, lng, address } = useLocation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch jobs from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Mock data - replace with API call
  const mockJobs: DeliveryJob[] = [
    {
      id: '1',
      pickup_address: '12 Adetokunbo Ademola Street, Victoria Island',
      dropoff_address: '45 Awolowo Road, Ikoyi',
      pickup_lat: 6.4281,
      pickup_lng: 3.4219,
      dropoff_lat: 6.4398,
      dropoff_lng: 3.4064,
      delivery_fee: 2500,
      distance_km: 3.2,
      estimated_time: '15 min',
      seller_name: 'Chike Electronics',
      items_count: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      pickup_address: '8 Allen Avenue, Ikeja',
      dropoff_address: '23 Ogunlana Drive, Surulere',
      pickup_lat: 6.6018,
      pickup_lng: 3.3515,
      dropoff_lat: 6.5432,
      dropoff_lng: 3.3491,
      delivery_fee: 3500,
      distance_km: 8.5,
      estimated_time: '25 min',
      seller_name: 'Bella Fashion',
      items_count: 1,
      created_at: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    setJobs(mockJobs);
    setLoading(false);
  }, []);

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <Text className="text-cream text-3xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Jobs</Text>
        {address && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={18} color="#9A8570" />
            <Text className="text-muted text-sm" numberOfLines={1} style={{ maxWidth: 120 }}>
              {address}
            </Text>
          </View>
        )}
      </View>

      {/* Filters */}
      <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  className=" self-start"
  contentContainerStyle={{
    paddingHorizontal: 20, // Replaces px-5 safely
    gap: 8,
    alignItems: 'center', // Prevents items from stretching vertically
  }}
>
  {FILTERS.map((filter) => (
    <TouchableOpacity
      key={filter.value}
      onPress={() => setActiveFilter(filter.value)}
      activeOpacity={0.75}
      className={`px-4 py-2 rounded-full border ${
        activeFilter === filter.value
          ? 'bg-green-500/20 border-green-500/50'
          : 'bg-dark-2 border-faint'
      }`}
    >
      <Text
        className={`text-xs ${
          activeFilter === filter.value ? 'text-green-500' : 'text-muted'
        }`}
        style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}
      >
        {filter.label}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

      {/* Jobs List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2D8653" />
        </View>
      ) : jobs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="bicycle-outline" size={48} color="#3D3026" />
          <Text className="text-cream text-lg mt-4" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            No jobs available
          </Text>
          <Text className="text-muted text-sm mt-2 text-center">
            Check back later for new delivery opportunities
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
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
