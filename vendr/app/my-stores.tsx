import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { VerificationStatusBanner } from '../components/ui/VerificationStatusBanner';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Store {
  id: string;
  business_name: string;
  category: string;
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  review_count: number;
}

interface VerificationStatus {
  status: 'pending' | 'approved' | 'rejected' | null;
  rejection_reason?: string;
}

export default function MyStoresScreen() {
  const { user } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [primaryStoreId, setPrimaryStoreId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const fetch = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const response = await apiFetch('/vendors/me/all', { method: 'GET' });
        // The backend returns an array of vendor objects
        const vendors = response.data;
        if (vendors && Array.isArray(vendors)) {
          const mappedStores = vendors.map((vendor: any) => ({
            id: vendor.id,
            business_name: vendor.shop_name,
            category: vendor.category,
            is_active: vendor.is_active,
            is_verified: vendor.user?.is_vendor_verified,
            rating: vendor.rating,
            review_count: vendor.review_count,
          }));
          setStores(mappedStores);
          
          // Set primary store for verification status
          if (mappedStores.length > 0) {
            setPrimaryStoreId(mappedStores[0].id);
            
            // Fetch verification status for the primary store
            try {
              const verifResponse = await apiFetch(`/verification/status/${mappedStores[0].id}`, { method: 'GET' });
              const verifData = verifResponse.data;
              if (verifData?.latest_request) {
                setVerificationStatus({
                  status: verifData.latest_request.status,
                  rejection_reason: verifData.latest_request.rejection_reason,
                });
              } else {
                setVerificationStatus({ status: null });
              }
            } catch (verifErr) {
              console.error('Failed to fetch verification status:', verifErr);
              setVerificationStatus({ status: null });
            }
          }
        } else {
          setStores([]);
          setVerificationStatus({ status: null });
        }
      } catch (err) {
        console.error('Failed to fetch stores:', err);
        setStores([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]));

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>My Stores</Text>
        <TouchableOpacity
          onPress={() => router.push('/become-vendor')}
          className="flex-row items-center gap-1.5 bg-orange rounded-xl px-3 py-2"
        >
          <Ionicons name="add" size={16} color="white" />
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: 'white', fontSize: 13 }}>New Store</Text>
        </TouchableOpacity>
      </View>

      {/* Verification Status Banner */}
      {!loading && stores.length > 0 && primaryStoreId && (
        <VerificationStatusBanner
          isVerified={stores[0].is_verified}
          verificationStatus={verificationStatus?.status}
          rejectionReason={verificationStatus?.rejection_reason}
          vendorId={primaryStoreId}
        />
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : stores.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="w-20 h-20 rounded-3xl bg-dark-2 border border-faint items-center justify-center">
            <Ionicons name="storefront-outline" size={36} color="#3D3026" />
          </View>
          <Text className="text-cream text-xl text-center" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>No stores yet</Text>
          <Text className="text-muted text-sm text-center">Create your first store to start selling on Vendr</Text>
          <TouchableOpacity onPress={() => router.push('/become-vendor')} className="bg-orange rounded-2xl px-6 py-3 mt-2">
            <Text className="text-white text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Create a Store</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/store/[storeId]', params: { storeId: item.id } })}
              activeOpacity={0.85}
              className="bg-dark-2 border border-faint rounded-2xl p-4 gap-3"
            >
              {/* Store header */}
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-2xl bg-orange/20 border border-orange/30 items-center justify-center">
                  <Ionicons name="storefront-outline" size={22} color="#E8521A" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{item.business_name}</Text>
                    {item.is_verified && <Ionicons name="shield-checkmark" size={14} color="#2D8653" />}
                  </View>
                  <Text className="text-muted text-xs mt-0.5">{item.category}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#3D3026" />
              </View>

              {/* Status + stats */}
              <View className="flex-row items-center gap-3 pt-3 border-t border-faint">
                <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${item.is_active ? 'bg-green-500/15' : 'bg-dark-3'}`}>
                  <View className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-dark-3 border border-faint'}`} />
                  <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: item.is_active ? '#4CAF50' : '#6B5E50' }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {item.review_count > 0 && (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={{ fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#F5A623' }}>
                      {item.rating?.toFixed(1)}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6B5E50', fontFamily: 'SpaceGrotesk_400Regular' }}>
                      ({item.review_count})
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}