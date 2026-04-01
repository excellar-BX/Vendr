//app/(tabs)/index.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { VendorCard } from '../../components/vendor/VendorCard';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { calcDistance } from '../../lib/utils';
import { Vendor, Category } from '../../types';
import { useLocation } from '../../hooks/useLocation';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: { label: Category | 'All'; icon: IoniconsName }[] = [
  { label: 'All',           icon: 'grid-outline' },
  { label: 'Food & Drinks', icon: 'fast-food-outline' },
  { label: 'Fashion',       icon: 'shirt-outline' },
  { label: 'Accessories',   icon: 'diamond-outline' },
  { label: 'Beauty & Hair', icon: 'cut-outline' },
  { label: 'Electronics',   icon: 'phone-portrait-outline' },
  { label: 'Groceries',     icon: 'basket-outline' },
];

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { lat, lng, address, loading: locationLoading } = useLocation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filtered, setFiltered] = useState<Vendor[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const userId = user?.id;

  // Fetch unread notification count
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      try {
        const response = await apiFetch('/users/me', { method: 'GET' });
        setUnreadNotifs(response.data.unread_notifications_count);
      } catch (err) {
        console.error('Failed to fetch notifications count:', err);
      }
    };
    fetchUnread();
  }, [userId]);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await apiFetch('/vendors', { method: 'GET' });
      // The backend returns vendors with lat/lng as separate fields
      let list: Vendor[] = response.data.map((v: any) => ({
        ...v,
        lat: v.lat ?? 0,
        lng: v.lng ?? 0,
      }));

      if (lat && lng) {
        list = list
          .map(v => ({ ...v, distance: calcDistance(lat, lng, v.lat, v.lng) }))
          .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
      }

      setVendors(list);
      setFiltered(activeCategory === 'All' ? list : list.filter(v => v.category === activeCategory));
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng, activeCategory]);

  useEffect(() => { fetchVendors(); }, [lat, lng]);

  useEffect(() => {
    setFiltered(activeCategory === 'All' ? vendors : vendors.filter(v => v.category === activeCategory));
  }, [activeCategory, vendors]);

  const onRefresh = () => { setRefreshing(true); fetchVendors(); };

  const userName = user?.full_name?.split(' ')[0] ?? 'there';

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-orange opacity-[0.06]" />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VendorCard vendor={item} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E8521A"
            colors={['#E8521A']}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View className="flex-row items-start justify-between pt-14 pb-5">
              <View className="flex-1">
                <Text className="text-muted text-sm mb-1">
                  Good {getGreeting()}
                </Text>
                <Text
                  className="text-cream text-2xl"
                  style={{ fontFamily: 'SpaceGrotesk_700Bold' }}
                >
                  Hey, {userName}
                </Text>

                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="location-outline" size={13} color="#9A8570" />
                  {locationLoading ? (
                    <Text className="text-muted text-xs">Getting location...</Text>
                  ) : (
                    <Text className="text-muted text-xs" numberOfLines={1}>
                      {address ?? 'Lagos, Nigeria'}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                style={{
                  width: 44, height: 44,
                  backgroundColor: '#1A1208',
                  borderWidth: 1, borderColor: '#2A1F14',
                  borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center',
                  marginTop: 4,
                }}
              >
                <Ionicons
                  name={unreadNotifs > 0 ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={unreadNotifs > 0 ? '#E8521A' : '#FDF6EC'}
                />
                {unreadNotifs > 0 && (
                  <View style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: '#E8521A',
                    borderWidth: 1.5, borderColor: '#0F0A06',
                  }} />
                )}
              </TouchableOpacity>
            </View>

            {/* Category filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.label;
                return (
                  <TouchableOpacity
                    key={cat.label}
                    onPress={() => setActiveCategory(cat.label)}
                    activeOpacity={0.8}
                    className={`flex-row items-center gap-2 px-4 py-2.5 rounded-2xl border ${
                      isActive ? 'bg-orange border-orange' : 'bg-dark-2 border-faint'
                    }`}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={15}
                      color={isActive ? 'white' : '#9A8570'}
                    />
                    <Text
                      className={isActive ? 'text-white' : 'text-muted'}
                      style={{
                        fontFamily: isActive ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular',
                        fontSize: 13,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Section title */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                {activeCategory === 'All' ? 'Vendors Near You' : activeCategory}
              </Text>
              <Text className="text-muted text-sm">{filtered.length} found</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center py-20 gap-4">
              <ActivityIndicator size="large" color="#E8521A" />
              <Text className="text-muted text-sm">Finding vendors near you...</Text>
            </View>
          ) : (
            <View className="items-center justify-center py-20 gap-3">
              <View className="w-16 h-16 rounded-2xl bg-dark-2 border border-faint items-center justify-center">
                <Ionicons name="storefront-outline" size={32} color="#6B5E50" />
              </View>
              <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>
                No vendors yet
              </Text>
              <Text className="text-muted text-sm text-center px-8">
                {activeCategory === 'All'
                  ? 'No vendors in your area yet. Check back soon!'
                  : `No ${activeCategory} vendors nearby. Try another category.`}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}