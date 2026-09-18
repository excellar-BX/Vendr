import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface RunnerStats {
  total_deliveries: number;
  total_earnings: number;
  rating: number;
  active_runs: number;
  this_week_deliveries: number;
  this_week_earnings: number;
}

interface QuickAction {
  label: string;
  icon: IoniconsName;
  route: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Find Jobs', icon: 'search-outline', route: '/(tabs)/runner-jobs', color: '#2D8653' },
  { label: 'Active Runs', icon: 'bicycle-outline', route: '/(tabs)/runner-active', color: '#5599E8' },
  { label: 'Earnings', icon: 'wallet-outline', route: '/(tabs)/runner-earnings', color: '#F5A623' },
  { label: 'History', icon: 'time-outline', route: '/runner-history', color: '#9A8570' },
];

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: IoniconsName; color: string;
}) {
  return (
    <View className="flex-1 bg-dark-2 border border-faint rounded-2xl p-4">
      <View className="flex-row items-center gap-2 mb-2">
        <View className={`w-8 h-8 rounded-full items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text className="text-muted text-xs">{label}</Text>
      </View>
      <Text className="text-cream text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
        {typeof value === 'number' && label.includes('₦') ? `₦${value.toLocaleString()}` : value}
      </Text>
    </View>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(action.route)}
      activeOpacity={0.85}
      className="flex-1 bg-dark-2 border border-faint rounded-2xl p-4 items-center"
    >
      <View className={`w-12 h-12 rounded-2xl items-center justify-center mb-2`} style={{ backgroundColor: `${action.color}20` }}>
        <Ionicons name={action.icon} size={24} color={action.color} />
      </View>
      <Text className="text-cream text-xs text-center" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function RunnerDashboardScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RunnerStats | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch stats from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Mock data - replace with API call
  const mockStats: RunnerStats = {
    total_deliveries: 47,
    total_earnings: 125500,
    rating: 4.8,
    active_runs: 2,
    this_week_deliveries: 12,
    this_week_earnings: 32500,
  };

  useEffect(() => {
    setStats(mockStats);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-dark items-center justify-center">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2D8653" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-green-500 opacity-[0.06]" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
        <View>
          <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
            Dashboard
          </Text>
          <Text className="text-muted text-xs">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Runner'}
          </Text>
        </View>
        <TouchableOpacity className="w-10 h-10 bg-dark-2 border border-faint rounded-xl items-center justify-center">
          <Ionicons name="notifications-outline" size={20} color="#FDF6EC" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2D8653" />
        }
      >
        {/* Quick Actions */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs tracking-widest uppercase mb-3" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            Quick Actions
          </Text>
          <View className="flex-row gap-3">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard key={action.label} action={action} />
            ))}
          </View>
        </View>

        {/* Stats Overview */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs tracking-widest uppercase mb-3" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            Overview
          </Text>
          <View className="flex-row gap-3 mb-3">
            <StatCard
              label="Total Deliveries"
              value={stats?.total_deliveries || 0}
              icon="bicycle-outline"
              color="#2D8653"
            />
            <StatCard
              label="Rating"
              value={`${stats?.rating || 0}`}
              icon="star-outline"
              color="#F5A623"
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              label="Total Earnings"
              value={stats?.total_earnings || 0}
              icon="wallet-outline"
              color="#5599E8"
            />
            <StatCard
              label="Active Runs"
              value={stats?.active_runs || 0}
              icon="flash-outline"
              color="#E8521A"
            />
          </View>
        </View>

        {/* This Week */}
        <View className="mx-5 bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-3xl p-5 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-green-500 text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
              This Week
            </Text>
            <TouchableOpacity>
              <Text className="text-muted text-xs">View All</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-xs mb-1">Deliveries</Text>
              <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {stats?.this_week_deliveries || 0}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs mb-1">Earnings</Text>
              <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                ₦{(stats?.this_week_earnings || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs tracking-widest uppercase mb-3" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
            Recent Activity
          </Text>
          <View className="space-y-3">
            {[
              { type: 'completed', title: 'Delivery completed', subtitle: 'Order #789012', time: '2 hours ago', icon: 'checkmark-circle-outline', color: '#2D8653' },
              { type: 'earned', title: 'Earning available', subtitle: '₦2,500 ready for withdrawal', time: '2 hours ago', icon: 'wallet-outline', color: '#F5A623' },
              { type: 'assigned', title: 'New job assigned', subtitle: 'Order #345678 - 3.2km', time: '5 hours ago', icon: 'flash-outline', color: '#5599E8' },
            ].map((activity, index) => (
              <TouchableOpacity
                key={index}
                className="bg-dark-2 border border-faint rounded-2xl p-4 flex-row items-center gap-3"
              >
                <View className={`w-10 h-10 rounded-xl items-center justify-center`} style={{ backgroundColor: `${activity.color}20` }}>
                  <Ionicons name={activity.icon} size={18} color={activity.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                    {activity.title}
                  </Text>
                  <Text className="text-muted text-xs">{activity.subtitle}</Text>
                </View>
                <Text className="text-muted text-xs">{activity.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tips */}
        <View className="mx-5 bg-orange/10 border border-orange/30 rounded-2xl p-4 mb-6">
          <View className="flex-row items-start gap-3">
            <Ionicons name="bulb-outline" size={20} color="#F5A623" />
            <View className="flex-1">
              <Text className="text-orange text-sm mb-1" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Pro Tip
              </Text>
              <Text className="text-muted text-xs">
                Complete deliveries quickly to build your rating and unlock higher-paying jobs.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
