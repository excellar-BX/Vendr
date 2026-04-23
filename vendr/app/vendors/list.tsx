import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { VendorCard } from '../../components/vendor/VendorCard';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { calcDistance } from '../../lib/utils';
import { Vendor } from '../../types';
import { useLocation } from '../../hooks/useLocation';

type SortParam = 'distance' | 'rating' | 'newest';

export default function VendorListScreen() {
  const { sort } = useLocalSearchParams<{ sort?: SortParam }>();
  const { user } = useAuthStore();
  const { lat, lng, loading: locationLoading } = useLocation();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userName = user?.full_name?.split(' ')[0] ?? 'there';

  // Determine screen title based on params
  const getTitle = () => {
    if (sort === 'distance') return 'Closest to You';
    if (sort === 'rating') return 'Top Rated';
    if (sort === 'newest') return 'New on Vendr';
    return 'All Vendors';
  };

  // Fetch & sort vendors
  const fetchVendors = useCallback(async () => {
    try {
      const response = await apiFetch('/vendors', { method: 'GET' });
      let list: Vendor[] = response.data.map((v: any) => ({
        ...v,
        lat: v.lat ?? 0,
        lng: v.lng ?? 0,
      }));

      // Apply distance calculation if location available
      if (lat && lng) {
        list = list
          .map(v => ({ ...v, distance: calcDistance(lat, lng, v.lat, v.lng) }))
          .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
      }

      // Apply sort
      if (sort === 'rating') {
        list = [...list].sort((a, b) => b.rating - a.rating);
      } else if (sort === 'newest') {
        list = [...list].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      // sort === 'distance' is already applied above as default

      setVendors(list);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng, sort]);

  useEffect(() => { fetchVendors(); }, [lat, lng, sort]);

  const onRefresh = () => { setRefreshing(true); fetchVendors(); };

  return (
    <>
      <Stack.Screen 
        options={{
          title: getTitle(),
          headerStyle: { backgroundColor: '#0F0A06' },
          headerTintColor: '#FDF6EC',
          headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 },
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
        <StatusBar style="light" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E8521A"
              colors={['#E8521A']}
            />
          }
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, paddingTop: 20 }}
        >
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <ActivityIndicator size="large" color="#E8521A" />
              <Text style={{ color: '#6B5E50', fontSize: 13 }}>Loading vendors...</Text>
            </View>
          ) : vendors.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 }}>
                  {getTitle()}
                </Text>
                <Text style={{ color: '#6B5E50', fontSize: 13 }}>{vendors.length} found</Text>
              </View>
              {vendors.map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function EmptyState() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
      <View
        style={{
          width: 64, height: 64,
          borderRadius: 20,
          backgroundColor: '#1A1208',
          borderWidth: 1, borderColor: '#2A1F14',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="storefront-outline" size={30} color="#3A2E25" />
      </View>
      <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17 }}>
        No vendors found
      </Text>
      <Text style={{ color: '#6B5E50', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
        No vendors match your criteria. Check back soon!
      </Text>
    </View>
  );
}
