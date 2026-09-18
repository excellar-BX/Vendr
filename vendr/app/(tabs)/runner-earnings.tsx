import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Earning {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'available' | 'paid';
  completed_at: string;
  paid_at?: string;
}

const TIME_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#F5A623', icon: 'time-outline' as IoniconsName },
  available: { label: 'Available', color: '#2D8653', icon: 'wallet-outline' as IoniconsName },
  paid: { label: 'Paid', color: '#9A8570', icon: 'checkmark-circle-outline' as IoniconsName },
};

function EarningCard({ earning }: { earning: Earning }) {
  const status = STATUS_CONFIG[earning.status];

  return (
    <View className="mx-5 bg-dark-2 border border-faint rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center gap-2">
          <View className={`w-8 h-8 rounded-full items-center justify-center`} style={{ backgroundColor: `${status.color}20` }}>
            <Ionicons name={status.icon} size={16} color={status.color} />
          </View>
          <View>
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Order #{earning.order_id.slice(-6)}
            </Text>
            <Text className="text-muted text-xs">{status.label}</Text>
          </View>
        </View>
        <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          ₦{earning.amount.toLocaleString()}
        </Text>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-faint">
        <Text className="text-muted text-xs">
          {new Date(earning.completed_at).toLocaleDateString('en-NG', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {earning.status === 'available' && (
          <TouchableOpacity className="bg-green-500/20 px-3 py-1.5 rounded-lg">
            <Text className="text-green-500 text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Withdraw
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function RunnerEarningsScreen() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch earnings from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Mock data - replace with API call
  const mockEarnings: Earning[] = [
    {
      id: '1',
      order_id: 'ORD-1234567890',
      amount: 2500,
      status: 'available',
      completed_at: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: '2',
      order_id: 'ORD-0987654321',
      amount: 3500,
      status: 'paid',
      completed_at: new Date(Date.now() - 24 * 60000).toISOString(),
      paid_at: new Date(Date.now() - 20 * 60000).toISOString(),
    },
    {
      id: '3',
      order_id: 'ORD-1122334455',
      amount: 1800,
      status: 'pending',
      completed_at: new Date(Date.now() - 30 * 60000).toISOString(),
    },
  ];

  useEffect(() => {
    setEarnings(mockEarnings);
    setLoading(false);
  }, []);

  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const availableBalance = earnings
    .filter(e => e.status === 'available')
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = earnings
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Earnings</Text>
      </View>

      {/* Balance Card */}
      <View className="mx-5 bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-3xl p-5 mb-4">
        <Text className="text-muted text-xs mb-1">Available Balance</Text>
        <Text className="text-cream text-3xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
          ₦{availableBalance.toLocaleString()}
        </Text>
        <View className="flex-row items-center gap-4 mt-4 pt-4 border-t border-green-500/20">
          <View>
            <Text className="text-muted text-xs">Total Earned</Text>
            <Text className="text-green-500 text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              ₦{totalEarnings.toLocaleString()}
            </Text>
          </View>
          <View>
            <Text className="text-muted text-xs">Pending</Text>
            <Text className="text-orange text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              ₦{pendingAmount.toLocaleString()}
            </Text>
          </View>
        </View>
        <TouchableOpacity className="bg-green-500 rounded-2xl py-3 mt-4 items-center">
          <Text className="text-dark text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            Withdraw to Wallet
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 mb-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {TIME_FILTERS.map((filter) => (
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

      {/* Earnings List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2D8653" />
        </View>
      ) : earnings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="wallet-outline" size={48} color="#3D3026" />
          <Text className="text-cream text-lg mt-4" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            No earnings yet
          </Text>
          <Text className="text-muted text-sm mt-2 text-center">
            Complete deliveries to start earning
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
          {earnings.map((earning) => (
            <EarningCard key={earning.id} earning={earning} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
