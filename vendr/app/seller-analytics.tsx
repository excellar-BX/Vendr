import { useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions, Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../lib/api';
import { RevenueChart } from '../components/analytics/RevenueChart';
import { ConversionFunnel } from '../components/analytics/ConversionFunnel';
import { PerformanceRing } from '../components/analytics/PerformanceRing';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  profile_views: number;
  product_views: number;
  inquiries: number;
  revenue: number;
  orders_count: number;
  unique_visitors: number;
  avg_order_value: number;
  conversion_rate: number;
  repeat_customers: number;
  revenue_growth: number;
  orders_growth: number;
  visitors_growth: number;
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
  conversion_rate?: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  daily_data: DailyData[];
  top_products: TopProduct[];
  period: 'day' | 'week' | 'month' | 'all';
}

// ─── Dummy Fallback ───────────────────────────────────────────────────────────

const DUMMY: AnalyticsData = {
  period: 'week',
  summary: {
    profile_views: 3840,
    product_views: 12490,
    inquiries: 284,
    revenue: 1845600,
    orders_count: 127,
    unique_visitors: 2910,
    avg_order_value: 14531,       // ← make sure this exists
    conversion_rate: 4.36,        // ← make sure this exists
    repeat_customers: 38,         // ← make sure this exists
    revenue_growth: 18.4,         // ← make sure this exists
    orders_growth: 12.1,          // ← make sure this exists
    visitors_growth: -3.2,        // ← make sure this exists
  },
  daily_data: [
    { date: 'Mon', profile_views: 480, product_views: 1620, inquiries: 32, revenue: 210000, orders_count: 14 },
    { date: 'Tue', profile_views: 520, product_views: 1890, inquiries: 41, revenue: 265000, orders_count: 18 },
    { date: 'Wed', profile_views: 390, product_views: 1340, inquiries: 28, revenue: 180000, orders_count: 12 },
    { date: 'Thu', profile_views: 610, product_views: 2100, inquiries: 55, revenue: 342000, orders_count: 23 },
    { date: 'Fri', profile_views: 740, product_views: 2480, inquiries: 67, revenue: 415000, orders_count: 28 },
    { date: 'Sat', profile_views: 680, product_views: 2260, inquiries: 38, revenue: 298000, orders_count: 21 },
    { date: 'Sun', profile_views: 420, product_views: 800,  inquiries: 23, revenue: 135600, orders_count: 11 },
  ],
  top_products: [
    { product_id: '1', product_name: 'Ankara Print Dress',    product_price: 18500, views: 1840, orders_count: 42, revenue: 777000, conversion_rate: 2.28 },
    { product_id: '2', product_name: 'Hand-Woven Basket Set', product_price: 12000, views: 1240, orders_count: 31, revenue: 372000, conversion_rate: 2.50 },
    { product_id: '3', product_name: 'Leather Crossbody Bag', product_price: 24500, views: 980,  orders_count: 24, revenue: 588000, conversion_rate: 2.45 },
    { product_id: '4', product_name: 'Beaded Necklace Set',   product_price: 8750,  views: 760,  orders_count: 18, revenue: 157500, conversion_rate: 2.37 },
    { product_id: '5', product_name: 'Kente Throw Pillow',    product_price: 6500,  views: 540,  orders_count: 12, revenue: 78000,  conversion_rate: 2.22 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '₦0.00';
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatCompact(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '₦0';
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '₦' + (n / 1_000).toFixed(1) + 'K';
  return '₦' + n.toString();
}

function formatNumber(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const PERIODS = [
  { label: 'Today', value: 'day' as const },
  { label: 'Week', value: 'week' as const },
  { label: 'Month', value: 'month' as const },
  { label: 'All', value: 'all' as const },
];

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SellerAnalyticsScreen() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'insights'>('overview');
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAnalytics = async (period: typeof selectedPeriod) => {
    try {
      const res = await apiFetch(`/users/me/analytics?period=${period}`, { method: 'GET' });
      setAnalytics(res.data ?? null);
    } catch {
      setAnalytics(null); // show no data state instead of dummy
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
      const hasVendor = !!profileRes.data?.vendor || !!vendorRes.data;
      setIsVendor(hasVendor);
      if (hasVendor) {
        await fetchAnalytics(selectedPeriod);
      } else {
        setLoading(false);
      }
    } catch {
      setIsVendor(false);
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setIsVendor(null);
    fetchVendorId();
  }, [user?.id]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics(selectedPeriod);
  };

  const handlePeriodChange = async (period: typeof selectedPeriod) => {
    if (period === selectedPeriod) return;
    setSelectedPeriod(period);
    setLoading(true);
    await fetchAnalytics(period);
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (isVendor === null || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
        <Text style={{ color: '#6B5E50', marginTop: 12, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13 }}>
          Loading analytics…
        </Text>
      </View>
    );
  }

  if (!isVendor) {
    return <NotVendorState />;
  }

  const data = analytics;
  const { summary, daily_data, top_products } = data || {};

  // ── Animated header opacity ────────────────────────────────────────────────

  const headerBg = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: ['rgba(15,10,6,0)', 'rgba(15,10,6,1)'],
    extrapolate: 'clamp',
  });

  const showEmptyState = !analytics || !summary || daily_data.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Sticky animated header */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99,
        backgroundColor: headerBg as any,
        paddingTop: 52, paddingBottom: 12, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', flex: 1 }}>
          Seller Analytics
        </Text>
        <TouchableOpacity
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }}
        >
          <Ionicons name="share-outline" size={18} color="#FDF6EC" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8521A" />}
      >
        {/* Hero Revenue Card - only show if we have data */}
        {!showEmptyState && <HeroCard summary={summary} period={selectedPeriod} />}

        {/* Period Selector */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          {!showEmptyState && (
            <View style={{ flexDirection: 'row', backgroundColor: '#1A1208', borderRadius: 14, padding: 4, gap: 4 }}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => handlePeriodChange(p.value)}
                  activeOpacity={0.75}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: selectedPeriod === p.value ? '#E8521A' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13,
                    color: selectedPeriod === p.value ? 'white' : '#9A8570',
                  }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Tab Switcher */}
        <View style={{ marginHorizontal: 20, marginBottom: 20, flexDirection: 'row', gap: 8 }}>
          {(['overview', 'products', 'insights'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                borderWidth: 1,
                borderColor: activeTab === tab ? '#E8521A' : '#2A1F14',
                backgroundColor: activeTab === tab ? 'rgba(232,82,26,0.12)' : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13,
                color: activeTab === tab ? '#E8521A' : '#6B5E50',
                textTransform: 'capitalize',
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Overview Tab ──────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          showEmptyState ? <EmptyState /> : (
            <>
              <StatGrid summary={summary!} />
              <RevenueChart data={daily_data!} />
              <OrdersBarChart data={daily_data!} />
              <ConversionFunnel summary={summary!} />
            </>
          )
        )}

        {/* ── Products Tab ──────────────────────────────────────────── */}
        {activeTab === 'products' && (
          showEmptyState ? <EmptyState /> : (
            <>
              <TopProductsList products={top_products || []} />
              <ProductPerformanceChart products={top_products || []} />
            </>
          )
        )}

        {/* ── Insights Tab ──────────────────────────────────────────── */}
        {activeTab === 'insights' && (
          showEmptyState ? <EmptyState /> : (
            <>
              <PerformanceRing summary={summary!} />
              <InsightsCards summary={summary!} />
              <GoalsSection summary={summary!} />
            </>
          )
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─── Not Vendor State ─────────────────────────────────────────────────────────
function NotVendorState() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          backgroundColor: '#0F0A06',
        }}
      >
        {/* decorative background circles */}
        <View
          style={{
            position: 'absolute',
            top: 80,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: 'rgba(232,82,26,0.05)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 120,
            left: -50,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        />

        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: '#1A1208',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            borderWidth: 1,
            borderColor: '#2A1F14',
          }}
        >
          <Ionicons name="bar-chart-outline" size={36} color="#3D3026" />
        </View>

        <Text
          style={{
            fontFamily: 'SpaceGrotesk_700Bold',
            fontSize: 20,
            color: '#FDF6EC',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Unlock Seller Analytics
        </Text>

        <Text
          style={{
            fontFamily: 'SpaceGrotesk_400Regular',
            fontSize: 14,
            color: '#6B5E50',
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          Become a vendor to access detailed analytics, track revenue, and grow your business.
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/become-vendor')}
          style={{
            backgroundColor: '#E8521A',
            borderRadius: 14,
            paddingHorizontal: 32,
            paddingVertical: 14,
          }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>
            Become a Vendor
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
// ─── Hero Card ────────────────────────────────────────────────────────────────

function HeroCard({ summary, period }: { summary: AnalyticsSummary; period: string }) {
  const growth = summary.revenue_growth ?? 0;
  const isPositive = growth >= 0;

  return (
    <View style={{ marginHorizontal: 20, marginTop: 112, marginBottom: 20 }}>
      <View
        style={{
          borderRadius: 24,
          padding: 24,
          borderWidth: 1,
          borderColor: '#3D2010',
          overflow: 'hidden',
          backgroundColor: '#1A1208',
        }}
      >
        {/* fake gradient effect with layered shapes */}
        <View
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: 'rgba(232,82,26,0.06)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(232,82,26,0.08)',
          }}
        />
       
        <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570', marginBottom: 6 }}>
          Total Revenue
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, color: '#FDF6EC', marginBottom: 8 }}>
          {formatCompact(summary.revenue)}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: isPositive ? 'rgba(45,134,83,0.15)' : 'rgba(220,53,69,0.15)',
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={isPositive ? '#2D8653' : '#DC3545'}
            />
            <Text
              style={{
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontSize: 12,
                color: isPositive ? '#2D8653' : '#DC3545',
              }}
            >
              {isPositive ? '+' : ''}
              {growth.toFixed(1)}%
            </Text>
          </View>

          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            vs previous {period}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          {[
            { label: 'Orders', value: formatNumber(summary.orders_count), growth: summary.orders_growth },
            { label: 'Visitors', value: formatNumber(summary.unique_visitors), growth: summary.visitors_growth },
            { label: 'Avg Order', value: formatCompact(summary.avg_order_value), growth: null },
          ].map((item, i) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                paddingLeft: i > 0 ? 16 : 0,
                borderLeftWidth: i > 0 ? 1 : 0,
                borderColor: '#2A1F14',
                marginLeft: i > 0 ? 16 : 0,
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>
                {item.value}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>
                  {item.label}
                </Text>
                {item.growth !== null && (
                  <Ionicons
                    name={(item.growth ?? 0) >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={(item.growth ?? 0) >= 0 ? '#2D8653' : '#DC3545'}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Stat Grid ────────────────────────────────────────────────────────────────

function StatGrid({ summary }: { summary: AnalyticsSummary }) {
  const stats = [
    { label: 'Profile Views', value: formatNumber(summary.profile_views), icon: 'eye-outline', color: '#5599E8', sub: 'people saw your store' },
    { label: 'Product Views', value: formatNumber(summary.product_views), icon: 'grid-outline', color: '#F5A623', sub: 'product impressions' },
    { label: 'Inquiries', value: formatNumber(summary.inquiries), icon: 'chatbubble-outline', color: '#9B59B6', sub: 'messages received' },
    { label: 'Conversion', value: `${summary.conversion_rate?.toFixed(1) ?? 0}%`, icon: 'checkmark-circle-outline', color: '#2D8653', sub: 'visit → order rate' },
    { label: 'Repeat Buyers', value: formatNumber(summary.repeat_customers), icon: 'refresh-circle-outline', color: '#E8521A', sub: 'returning customers' },
    { label: 'Unique Visitors', value: formatNumber(summary.unique_visitors), icon: 'people-outline', color: '#E67E22', sub: 'distinct users' },
  ];

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <SectionHeader title="Key Metrics" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              width: (width - 52) / 2,
              backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
              borderRadius: 16, padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${stat.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={stat.icon as any} size={16} color={stat.color} />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#9A8570', flex: 1 }}>{stat.label}</Text>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC' }}>{stat.value}</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#3D3026', marginTop: 4 }}>{stat.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Orders Bar Chart ─────────────────────────────────────────────────────────

function OrdersBarChart({ data }: { data: DailyData[] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders_count), 1);

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <SectionHeader title="Daily Orders" subtitle="This period" />
      <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, marginBottom: 8 }}>
          {data.map((d, i) => {
            const heightPct = (d.orders_count / maxOrders) * 100;
            const isMax = d.orders_count === maxOrders;
            return (
              <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                {isMax && (
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, color: '#E8521A', marginBottom: 2 }}>
                    {d.orders_count}
                  </Text>
                )}
                <View style={{
                  width: 28, borderRadius: 6,
                  height: `${Math.max(heightPct, 8)}%` as any,
                  backgroundColor: isMax ? '#E8521A' : '#2A1F14',
                }} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {data.map((d, i) => (
            <Text key={i} style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#6B5E50', flex: 1, textAlign: 'center' }}>
              {d.date}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            Total: <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              {data.reduce((s, d) => s + d.orders_count, 0)} orders
            </Text>
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
            Peak: <Text style={{ color: '#E8521A', fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              {maxOrders}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Top Products List ────────────────────────────────────────────────────────

function TopProductsList({ products }: { products: TopProduct[] }) {
  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader title="Top Performing Products" />
        <TouchableOpacity onPress={() => router.push('/my-stores')}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Manage</Text>
        </TouchableOpacity>
      </View>

      {products.length === 0 ? (
        <EmptyProducts />
      ) : (
        <View style={{ gap: 12 }}>
          {products.map((product, index) => (
            <View
              key={product.product_id}
              style={{
                backgroundColor: '#1A1208', borderWidth: 1,
                borderColor: index === 0 ? 'rgba(255,215,0,0.2)' : '#2A1F14',
                borderRadius: 16, padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Rank badge */}
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: index < 3 ? `${MEDAL[index]}18` : '#0F0A06',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: index < 3 ? `${MEDAL[index]}40` : '#2A1F14',
                }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: index < 3 ? MEDAL[index] : '#3D3026' }}>
                    {index + 1}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>
                    {product.product_name}
                  </Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>
                    {formatAmount(product.product_price)} · {product.views} views
                  </Text>
                </View>

                {/* Revenue */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#2D8653' }}>
                    {formatCompact(product.revenue)}
                  </Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginTop: 2 }}>
                    {product.orders_count} orders
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={{ marginTop: 12, height: 4, backgroundColor: '#0F0A06', borderRadius: 2 }}>
                <View style={{
                  height: 4, borderRadius: 2,
                  backgroundColor: index < 3 ? MEDAL[index] : '#E8521A',
                  width: `${Math.min((product.revenue / (products[0]?.revenue || 1)) * 100, 100)}%`,
                }} />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#3D3026', marginTop: 4 }}>
                {((product.revenue / (products[0]?.revenue || 1)) * 100).toFixed(0)}% of top product revenue
                {product.conversion_rate ? ` · ${product.conversion_rate}% conversion` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Product Performance Chart ────────────────────────────────────────────────

function ProductPerformanceChart({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return null;
  const maxViews = Math.max(...products.map((p) => p.views), 1);

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <SectionHeader title="Views vs Orders" subtitle="Product comparison" />
      <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 20, gap: 14 }}>
        {products.map((p) => (
          <View key={p.product_id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#9A8570' }} numberOfLines={1}>
                {p.product_name}
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#5599E8' }}>
                {p.views} views
              </Text>
            </View>
            {/* Views bar */}
            <View style={{ height: 8, backgroundColor: '#0F0A06', borderRadius: 4, marginBottom: 4 }}>
              <View style={{
                height: 8, borderRadius: 4, backgroundColor: '#5599E8',
                width: `${(p.views / maxViews) * 100}%`,
              }} />
            </View>
            {/* Orders bar */}
            <View style={{ height: 5, backgroundColor: '#0F0A06', borderRadius: 4 }}>
              <View style={{
                height: 5, borderRadius: 4, backgroundColor: '#E8521A',
                width: `${Math.min((p.orders_count / p.views) * 100 * 8, 100)}%`,
              }} />
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 8, borderRadius: 2, backgroundColor: '#5599E8' }} />
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>Views</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 5, borderRadius: 2, backgroundColor: '#E8521A' }} />
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>Conversion</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Insights Cards ───────────────────────────────────────────────────────────

function InsightsCards({ summary }: { summary: AnalyticsSummary }) {
  const insights = [
    {
      icon: 'trending-up' as const,
      color: '#2D8653',
      bg: 'rgba(45,134,83,0.08)',
      border: 'rgba(45,134,83,0.2)',
      title: 'Revenue Growing',
      body: `Your revenue grew by ${summary.revenue_growth?.toFixed(1) ?? 0}% this period. Keep consistent product quality and prompt delivery.`,
    },
    {
      icon: 'people-outline' as const,
      color: '#5599E8',
      bg: 'rgba(85,153,232,0.08)',
      border: 'rgba(85,153,232,0.2)',
      title: 'Visitor Engagement',
       body: `${(((summary.inquiries ?? 0) / (summary.unique_visitors ?? 1)) * 100).toFixed(1)}% of visitors sent an inquiry. Add detailed FAQs to convert more.`,
    },
    {
      icon: 'repeat-outline' as const,
      color: '#E8521A',
      bg: 'rgba(232,82,26,0.08)',
      border: 'rgba(232,82,26,0.2)',
      title: 'Repeat Customers',
      body: `${summary.repeat_customers} customers came back. Offer loyalty discounts to increase repeat purchase rate.`,
    },
    {
      icon: 'flash-outline' as const,
      color: '#F5A623',
      bg: 'rgba(245,166,35,0.08)',
      border: 'rgba(245,166,35,0.2)',
      title: 'Conversion Tip',
      body: `Your ${summary.conversion_rate?.toFixed(1)}% conversion rate can improve. Try adding short product demo reels.`,
    },
  ];

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <SectionHeader title="Smart Insights" />
      <View style={{ gap: 12 }}>
        {insights.map((insight) => (
          <View
            key={insight.title}
            style={{
              backgroundColor: insight.bg, borderWidth: 1, borderColor: insight.border,
              borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${insight.color}20`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <Ionicons name={insight.icon} size={18} color={insight.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC', marginBottom: 4 }}>
                {insight.title}
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', lineHeight: 20 }}>
                {insight.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Goals Section ────────────────────────────────────────────────────────────

function GoalsSection({ summary }: { summary: AnalyticsSummary }) {
  const goals = [
    { label: 'Revenue Goal', current: summary.revenue, target: 2_000_000, color: '#2D8653', format: formatCompact },
    { label: 'Orders Goal', current: summary.orders_count, target: 150, color: '#E8521A', format: formatNumber },
    { label: 'Visitor Goal', current: summary.unique_visitors, target: 5_000, color: '#5599E8', format: formatNumber },
  ];

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
      <SectionHeader title="Monthly Goals" subtitle="Set in store settings" />
      <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 20, gap: 18 }}>
        {goals.map((g) => {
          const pct = Math.min((g.current / g.target) * 100, 100);
          return (
            <View key={g.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570' }}>{g.label}</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>
                  {g.format(g.current)} / {g.format(g.target)}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: '#0F0A06', borderRadius: 4 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: g.color, width: `${pct}%` }} />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#3D3026', marginTop: 4 }}>
                {pct.toFixed(0)}% complete
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>{title}</Text>
      {subtitle && (
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 2 }}>{subtitle}</Text>
      )}
    </View>
  );
}

function EmptyProducts() {
  return (
    <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 }}>
      <Ionicons name="cube-outline" size={32} color="#3D3026" />
      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#6B5E50' }}>No product data yet</Text>
      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026', textAlign: 'center' }}>
        Add products to start tracking performance
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/my-stores')}
        style={{ backgroundColor: 'rgba(232,82,26,0.15)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 }}
      >
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Add Products</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 }}>
      <Ionicons name="analytics-outline" size={32} color="#3D3026" />
      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#6B5E50' }}>No analytics data yet</Text>
      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026', textAlign: 'center' }}>
        Check back later once you have activity
      </Text>
    </View>
  );
}