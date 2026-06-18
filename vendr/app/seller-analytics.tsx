import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../lib/api';

const { width } = Dimensions.get('window');

interface AnalyticsSummary {
  profile_views: number;
  product_views: number;
  inquiries: number;
  revenue: number;
  orders_count: number;
  unique_visitors: number;
}

interface DailyData {
  date: string;
  profile_views: number;
  product_views: number;
  inquiries: number;
  revenue: number;
  orders_count: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  product_price: number;
  product_image?: string;
  views: number;
  orders_count: number;
  revenue: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  daily_data: DailyData[];
  top_products: TopProduct[];
  period: 'day' | 'week' | 'month' | 'all';
}

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function SellerAnalyticsScreen() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState<boolean | null>(null);

  const fetchAnalytics = async (vid: string, period: 'day' | 'week' | 'month' | 'all') => {
    try {
      const res = await apiFetch(`/vendors/${vid}/analytics?period=${period}`, {
        method: 'GET',
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchVendorId = async () => {
    try {
      const [profileRes, vendorRes] = await Promise.all([
        apiFetch('/users/me', { method: 'GET' }),
        apiFetch('/vendors/me', { method: 'GET' }),
      ]);

      const hasVendor = !!profileRes.data?.vendor;
      setIsVendor(hasVendor);

      if (hasVendor && vendorRes.data?.id) {
        const vid = vendorRes.data.id;
        setVendorId(vid);
        await fetchAnalytics(vid, selectedPeriod);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch vendor:', err);
      setIsVendor(false);
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setIsVendor(null);
      fetchVendorId();
    }, [user?.id]) // depend on user id, not is_vendor
  );

  const onRefresh = async () => {
    if (!vendorId) return;
    setRefreshing(true);
    await fetchAnalytics(vendorId, selectedPeriod);
  };

  const handlePeriodChange = async (period: 'day' | 'week' | 'month' | 'all') => {
    if (!vendorId) return;
    setSelectedPeriod(period);
    setLoading(true);
    await fetchAnalytics(vendorId, period);
  };

  // Still checking vendor status
  if (isVendor === null || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  if (!isVendor) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Ionicons name="storefront-outline" size={48} color="#3D3026" />
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#6B5E50', marginTop: 16, textAlign: 'center' }}>
          Vendor Analytics
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#3D3026', marginTop: 8, textAlign: 'center' }}>
          You need to be a vendor to view analytics
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/become-vendor')}
          style={{ backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: 'white' }}>Become a Vendor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  const summary = analytics?.summary;
  const topProducts = analytics?.top_products || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', flex: 1 }}>Seller Analytics</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8521A" />}
      >
        {/* Period Selector */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', backgroundColor: '#1A1208', borderRadius: 14, padding: 4, gap: 4 }}>
            {[
              { label: 'Day', value: 'day' as const },
              { label: 'Week', value: 'week' as const },
              { label: 'Month', value: 'month' as const },
              { label: 'All', value: 'all' as const },
            ].map((period) => (
              <TouchableOpacity
                key={period.value}
                onPress={() => handlePeriodChange(period.value)}
                activeOpacity={0.75}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: selectedPeriod === period.value ? '#E8521A' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: selectedPeriod === period.value ? 'white' : '#9A8570' }}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary Cards */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>Overview</Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Revenue', value: formatAmount(summary?.revenue || 0), icon: 'cash-outline', color: '#2D8653' },
              { label: 'Orders', value: formatNumber(summary?.orders_count || 0), icon: 'bag-outline', color: '#E8521A' },
              { label: 'Profile Views', value: formatNumber(summary?.profile_views || 0), icon: 'eye-outline', color: '#5599E8' },
              { label: 'Product Views', value: formatNumber(summary?.product_views || 0), icon: 'grid-outline', color: '#F5A623' },
              { label: 'Inquiries', value: formatNumber(summary?.inquiries || 0), icon: 'chatbubble-outline', color: '#9B59B6' },
              { label: 'Unique Visitors', value: formatNumber(summary?.unique_visitors || 0), icon: 'people-outline', color: '#E67E22' },
            ].map((stat) => (
              <View key={stat.label} style={{ width: (width - 52) / 2, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, padding: 16, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${stat.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#9A8570' }}>{stat.label}</Text>
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Products */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Top Products</Text>
            {topProducts.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/my-stores')}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Manage Products</Text>
              </TouchableOpacity>
            )}
          </View>

          {topProducts.length === 0 ? (
            <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 }}>
              <Ionicons name="cube-outline" size={32} color="#3D3026" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#6B5E50' }}>No product data yet</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026', textAlign: 'center' }}>
                Add products to start tracking performance
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {topProducts.map((product, index) => (
                <View key={product.product_id} style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
                    {product.product_image ? (
                      <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden' }}>
                        {/* Image component would go here */}
                        <View style={{ width: 48, height: 48, backgroundColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="image-outline" size={20} color="#3D3026" />
                        </View>
                      </View>
                    ) : (
                      <Ionicons name="cube-outline" size={24} color="#3D3026" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, color: index < 3 ? '#0F0A06' : '#6B5E50' }}>{index + 1}</Text>
                      </View>
                      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>
                        {product.product_name}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }}>
                      {formatAmount(product.product_price)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#2D8653' }}>{formatAmount(product.revenue)}</Text>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{product.orders_count} orders</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Performance Tips */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>Insights</Text>
          <View style={{ backgroundColor: 'rgba(45,134,83,0.08)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.2)', borderRadius: 16, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(45,134,83,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Ionicons name="lightbulb-outline" size={18} color="#2D8653" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC', marginBottom: 4 }}>Boost Your Sales</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 20 }}>
                  Add more product photos, update descriptions regularly, and respond quickly to customer inquiries to increase conversion rates.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
