import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { VerificationStatusBanner } from '../components/ui/VerificationStatusBanner';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { T, useTheme } from '../constants/theme';

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
  useTheme();
  const { user } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [primaryStoreId, setPrimaryStoreId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
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
            
            // Set primary store for verification status
            if (mappedStores.length > 0) {
              const primaryId = mappedStores[0].id;
              
              // Fetch verification status for the primary store
              let verifStatus: VerificationStatus = { status: null };
              try {
                console.log('Fetching verification status for vendor:', primaryId);
                const verifResponse = await apiFetch(`/verification/status/${primaryId}`, { method: 'GET' });
                console.log('Verification API response:', verifResponse);
                // apiFetch returns response directly, not wrapped in .data
                if (verifResponse?.latest_request) {
                  verifStatus = {
                    status: verifResponse.latest_request.status,
                    rejection_reason: verifResponse.latest_request.rejection_reason,
                  };
                } else {
                  console.log('No latest_request found in response');
                }
              } catch (verifErr) {
                console.error('Failed to fetch verification status:', verifErr);
              }
              
              // Batch all state updates together
              setStores(mappedStores);
              setPrimaryStoreId(primaryId);
              setVerificationStatus(verifStatus);
              console.log('Verification status fetched:', verifStatus);
            } else {
              setStores([]);
              setPrimaryStoreId(null);
              setVerificationStatus({ status: null });
            }
          } else {
            setStores([]);
            setPrimaryStoreId(null);
            setVerificationStatus({ status: null });
          }
        } catch (err) {
          console.error('Failed to fetch stores:', err);
          setStores([]);
          setPrimaryStoreId(null);
          setVerificationStatus({ status: null });
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }, [user?.id])
  );

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-line gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text className="text-ink text-xl flex-1" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>My Stores</Text>
        <TouchableOpacity
          onPress={() => router.push('/become-vendor')}
          className="flex-row items-center gap-1.5 bg-orange rounded-xl px-3 py-2"
        >
          <Ionicons name="add" size={16} color="white" />
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: 'white', fontSize: 13 }}>New Store</Text>
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
          <View className="w-20 h-20 rounded-3xl bg-surface border border-line items-center justify-center">
            <Ionicons name="storefront-outline" size={36} color={T.ink4} />
          </View>
          <Text className="text-ink text-xl text-center" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>No stores yet</Text>
          <Text className="text-ink-2 text-sm text-center">Create your first store to start selling on Vendr</Text>
          <TouchableOpacity onPress={() => router.push('/become-vendor')} className="bg-orange rounded-2xl px-6 py-3 mt-2">
            <Text className="text-white text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>Create a Store</Text>
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
              className="bg-surface border border-line rounded-2xl p-4 gap-3"
            >
              {/* Store header */}
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-2xl bg-orange/20 border border-orange/30 items-center justify-center">
                  <Ionicons name="storefront-outline" size={22} color="#E8521A" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-ink text-base" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{item.business_name}</Text>
                    {item.is_verified && <Ionicons name="shield-checkmark" size={14} color="#2D8653" />}
                  </View>
                  <Text className="text-ink-2 text-xs mt-0.5">{item.category}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.ink4} />
              </View>

              {/* Status + stats */}
              <View className="flex-row items-center gap-3 pt-3 border-t border-line">
                <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${item.is_active ? 'bg-success/15' : 'bg-surface-2'}`}>
                  <View className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-success' : 'bg-surface-2 border border-line'}`} />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: item.is_active ? T.successInk : T.ink3 }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {item.review_count > 0 && (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.goldInk }}>
                      {item.rating?.toFixed(1)}
                    </Text>
                    <Text style={{ fontSize: 11, color: T.ink3, fontFamily: 'PlusJakartaSans_400Regular' }}>
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