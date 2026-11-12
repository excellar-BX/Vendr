// app/(tabs)/index.tsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, Image, ImageBackground,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text } from '../../components/ui/StyledText';
import { VendorCard } from '../../components/vendor/VendorCard';
import { VendorRow } from '../../components/vendor/VendorRow';
import { formatCount, openHashtag } from '../../components/reel/ReelViewer';
import { useAuthStore } from '../../stores/authStore';
import { calcDistance, formatDistance } from '../../lib/utils';
import { reelApi, hashtagApi, HashtagSummary } from '../../lib/api';
import { Vendor, Category } from '../../types';
import { useLocation } from '../../hooks/useLocation';
import { useVendors, useUnreadNotificationsCount } from '../../hooks/useQueries';
import { T, useTheme } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const H_PAD = 20;

// Same palette as the Search tab so categories look the same everywhere
const CATEGORIES: { label: Category; short: string; icon: IoniconsName; color: string }[] = [
  { label: 'Food & Drinks', short: 'Food',        icon: 'fast-food',      color: '#E8521A' },
  { label: 'Fashion',       short: 'Fashion',     icon: 'shirt',          color: '#D97706' },
  { label: 'Beauty & Hair', short: 'Beauty',      icon: 'cut',            color: '#DB2777' },
  { label: 'Electronics',   short: 'Gadgets',     icon: 'phone-portrait', color: '#2563EB' },
  { label: 'Groceries',     short: 'Groceries',   icon: 'basket',         color: '#2D8653' },
  { label: 'Accessories',   short: 'Accessories', icon: 'diamond',        color: '#7C3AED' },
];
const categoryColor = (c?: string | null) => CATEGORIES.find((x) => x.label === c)?.color ?? '#E8521A';

const SEARCH_HINTS = ['jollof rice', 'ankara gowns', 'iPhone 13', 'shea butter', 'sneakers', 'small chops', 'power banks', 'braids'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const toMinutes = (hhmm?: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Open right now? Handles shops that close after midnight. */
function isOpenNow(v: Vendor, now = new Date()) {
  const open = toMinutes(v.open_time);
  const close = toMinutes(v.close_time);
  if (open == null || close == null) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  return open <= close ? t >= open && t < close : t >= open || t < close;
}

const isVerified = (v: Vendor) => !!(v.user?.is_vendor_verified ?? v.is_verified);

/** Featured = strong rating, verified, reviewed, has a banner, and not too far. */
function featuredScore(v: Vendor) {
  let s = (v.rating || 0) * 10 + Math.sqrt(v.review_count || 0) * 2;
  if (isVerified(v)) s += 8;
  if (v.banner_url) s += 6;
  if (v.distance != null) s += v.distance < 3 ? 12 : v.distance < 10 ? 8 : v.distance < 30 ? 3 : 0;
  return s;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isVendor } = useAuthStore();
  const { lat, lng, address, loading: locationLoading } = useLocation();
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const { data: vendorsData, isLoading: vendorsLoading, refetch: refetchVendors } = useVendors(lat, lng);
  const { data: unreadNotifs } = useUnreadNotificationsCount();

  // Round the location so tiny GPS jitter doesn't refetch the strip
  const latKey = lat != null ? Math.round(lat * 100) / 100 : null;
  const lngKey = lng != null ? Math.round(lng * 100) / 100 : null;
  const reelsQuery = useQuery({
    queryKey: ['home-reels', latKey, lngKey],
    queryFn: async () => {
      const { data } = await reelApi.getReels({ limit: 12, lat: latKey, lng: lngKey });
      return (data ?? []) as any[];
    },
    staleTime: 1000 * 60 * 3,
  });
  const tagsQuery = useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: async () => ((await hashtagApi.trending(12)).data ?? []) as HashtagSummary[],
    staleTime: 1000 * 60 * 10,
  });

  const vendors = useMemo(() => {
    if (!vendorsData) return [] as Vendor[];
    let list: Vendor[] = (vendorsData as any[]).map((v) => ({ ...v, lat: v.lat ?? null, lng: v.lng ?? null }));
    if (lat != null && lng != null) {
      list = list
        .map((v) => ({ ...v, distance: v.lat != null && v.lng != null ? calcDistance(lat, lng, v.lat, v.lng) : undefined }))
        .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
    }
    return list;
  }, [vendorsData, lat, lng]);

  const featured = useMemo(() => [...vendors].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 5), [vendors]);
  const openNow = useMemo(() => vendors.filter((v) => isOpenNow(v)).slice(0, 10), [vendors]);
  const topRated = useMemo(() => [...vendors].filter((v) => v.rating > 0).sort((a, b) => b.rating - a.rating || b.review_count - a.review_count).slice(0, 10), [vendors]);
  const newest = useMemo(() => [...vendors].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10), [vendors]);
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    vendors.forEach((v) => { m[v.category] = (m[v.category] ?? 0) + 1; });
    return m;
  }, [vendors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchVendors(), reelsQuery.refetch(), tagsQuery.refetch()]);
    setRefreshing(false);
  };

  const openList = (params?: Record<string, string>) => router.push({ pathname: '/vendors/list', params });
  const loading = vendorsLoading && vendors.length === 0;
  const area = locationLoading ? 'Finding you…' : (address?.split(',')[0] ?? 'Set location');

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[T.primary]} progressViewOffset={insets.top} />}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <Hero
          topInset={insets.top}
          firstName={firstName}
          area={area}
          unread={unreadNotifs ?? 0}
        />

        {/* ── Categories ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: H_PAD, marginTop: 22 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
            {CATEGORIES.map((c, i) => (
              <CategoryTile
                key={c.label}
                index={i}
                label={c.short}
                icon={c.icon}
                color={c.color}
                count={categoryCounts[c.label]}
                onPress={() => openList({ category: c.label })}
              />
            ))}
            <CategoryTile index={6} label="Map" icon="map" color="#0F766E" onPress={() => router.push('/map-search')} />
            <CategoryTile index={7} label="All stores" icon="storefront" color={T.ink2} count={vendors.length || undefined} onPress={() => openList()} />
          </View>
        </View>

        {/* ── Fresh on Reels ───────────────────────────────────────────── */}
        {(reelsQuery.data?.length ?? 0) > 0 && (
          <Section title="Fresh on Reels" subtitle="New posts from stores near you" onSeeAll={() => router.push('/(tabs)/reels')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 10 }}>
              {reelsQuery.data!.map((r) => <ReelTile key={r.id} reel={r} />)}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/reels')}
                activeOpacity={0.85}
                style={{ width: 112, height: 190, borderRadius: 18, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.canvas, textAlign: 'center' }}>Watch{'\n'}all reels</Text>
              </TouchableOpacity>
            </ScrollView>
          </Section>
        )}

        {loading ? (
          <HomeSkeleton width={width} />
        ) : vendors.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Featured carousel ────────────────────────────────────── */}
            {featured.length > 0 && (
              <Section title="Featured stores" subtitle="Highly rated and close by">
                <FeaturedCarousel vendors={featured} width={width} />
              </Section>
            )}

            {/* ── Open now ─────────────────────────────────────────────── */}
            {openNow.length > 0 && (
              <Section
                title="Open now near you"
                badge={<LiveDot />}
                onSeeAll={() => openList({ sort: 'distance' })}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD }}>
                  {openNow.map((v) => <VendorRow key={v.id} vendor={v} width={156} />)}
                </ScrollView>
              </Section>
            )}

            {/* ── Trending hashtags ────────────────────────────────────── */}
            {(tagsQuery.data?.length ?? 0) > 0 && (
              <Section title="Trending on Vendr" subtitle="What people are posting about">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 8 }}>
                  {tagsQuery.data!.map((t, i) => (
                    <TouchableOpacity
                      key={t.tag}
                      onPress={() => openHashtag(t.tag)}
                      activeOpacity={0.8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 40, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i < 3 ? T.primary : T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: i < 3 ? '#FFFFFF' : T.primaryInk }}>#</Text>
                      </View>
                      <View>
                        <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>{t.tag}</Text>
                        <Text style={{ fontSize: 10.5, color: T.ink3 }}>{formatCount(t.post_count)} post{t.post_count === 1 ? '' : 's'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Section>
            )}

            {/* ── Top rated ────────────────────────────────────────────── */}
            {topRated.length > 0 && (
              <Section title="Top rated" subtitle="Loved by buyers" onSeeAll={() => openList({ sort: 'rating' })}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD }}>
                  {topRated.map((v) => <VendorRow key={v.id} vendor={v} width={156} />)}
                </ScrollView>
              </Section>
            )}

            {/* ── Sell / post CTA ──────────────────────────────────────── */}
            <View style={{ paddingHorizontal: H_PAD, marginTop: 28 }}>
              <PromoBanner isVendor={isVendor} />
            </View>

            {/* ── New on Vendr ─────────────────────────────────────────── */}
            {newest.length > 0 && (
              <Section title="New on Vendr" subtitle="Just opened — say hi" onSeeAll={() => openList({ sort: 'newest' })}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: H_PAD }}>
                  {newest.map((v) => <VendorRow key={v.id} vendor={v} width={156} />)}
                </ScrollView>
              </Section>
            )}

            {/* ── More stores ──────────────────────────────────────────── */}
            <Section title={lat != null ? 'More stores near you' : 'More stores'}>
              <View style={{ paddingHorizontal: H_PAD }}>
                {vendors.slice(0, 8).map((v) => <VendorCard key={v.id} vendor={v} />)}
                {vendors.length > 8 && (
                  <TouchableOpacity
                    onPress={() => openList()}
                    activeOpacity={0.85}
                    style={{ height: 50, borderRadius: 16, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>See all {vendors.length} stores</Text>
                    <Ionicons name="arrow-forward" size={16} color={T.ink} />
                  </TouchableOpacity>
                )}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({ topInset, firstName, area, unread }: { topInset: number; firstName: string; area: string; unread: number }) {
  useTheme();
  const [hint, setHint] = useState(0);
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    if (!focused) return;
    const t = setInterval(() => setHint((h) => (h + 1) % SEARCH_HINTS.length), 2600);
    return () => clearInterval(t);
  }, [focused]);

  return (
    <View style={{ backgroundColor: '#E8521A', paddingTop: topInset + 10, paddingHorizontal: H_PAD, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
      {/* soft decorative shapes */}
      <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.08)', top: -90, right: -70 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -60, left: -40 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(245,166,35,0.35)', top: 60, right: 40 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => router.push('/map-search')}
          activeOpacity={0.8}
          accessibilityLabel={`Location: ${area}. Open map`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%', backgroundColor: 'rgba(0,0,0,0.16)', paddingHorizontal: 12, height: 34, borderRadius: 17 }}
        >
          <Ionicons name="location" size={14} color="#FFFFFF" />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF' }}>{area}</Text>
          <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={20} color="#FFFFFF" />
          {unread > 0 && (
            <View style={{ position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#E8521A' }}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeInDown.duration(350)} style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFamily: 'PlusJakartaSans_500Medium' }}>{getGreeting()}, {firstName} 👋</Text>
        <Text style={{ fontSize: 27, lineHeight: 33, color: '#FFFFFF', fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.6, marginTop: 2 }}>
          What are you buying{'\n'}today?
        </Text>
      </Animated.View>

      <TouchableOpacity
        onPress={() => router.push('/search')}
        activeOpacity={0.9}
        accessibilityLabel="Search vendors and products"
        style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, paddingLeft: 14, paddingRight: 6, height: 52, shadowColor: '#7C2D12', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Ionicons name="search" size={19} color="#78716C" />
        <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
          <Text style={{ fontSize: 14.5, color: '#78716C' }}>Search </Text>
          <Animated.View key={hint} entering={FadeIn.duration(300)}>
            <Text numberOfLines={1} style={{ fontSize: 14.5, color: '#1C1917', fontFamily: 'PlusJakartaSans_600SemiBold' }}>{SEARCH_HINTS[hint]}…</Text>
          </Animated.View>
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={18} color="#E8521A" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Section({ title, subtitle, onSeeAll, badge, children }: {
  title: string; subtitle?: string; onSeeAll?: () => void; badge?: React.ReactNode; children: React.ReactNode;
}) {
  useTheme();
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: H_PAD, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.3 }}>{title}</Text>
            {badge}
          </View>
          {!!subtitle && <Text style={{ fontSize: 12.5, color: T.ink3, marginTop: 1 }}>{subtitle}</Text>}
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.primaryInk }}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={T.primaryInk} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function CategoryTile({ label, icon, color, count, onPress, index }: {
  label: string; icon: IoniconsName; color: string; count?: number; onPress: () => void; index: number;
}) {
  useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(40 * index).duration(300)} style={{ width: '25%', alignItems: 'center' }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityLabel={label} style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={25} color={color} />
          {!!count && (
            <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink2 }}>{count > 99 ? '99+' : count}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ReelTile({ reel }: { reel: any }) {
  useTheme();
  const isPhoto = reel.media_type === 'photo';
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/reel/[reelId]', params: { reelId: reel.id, vendorId: reel.vendor_id } })}
      activeOpacity={0.88}
      style={{ width: 112, height: 190, borderRadius: 18, overflow: 'hidden', backgroundColor: T.surface2 }}
    >
      {!!reel.thumbnail_url && <Image source={{ uri: reel.thumbnail_url }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.42)' }} />
      <View style={{ position: 'absolute', top: 8, left: 8, borderRadius: 18, borderWidth: 2, borderColor: '#E8521A', padding: 1.5, backgroundColor: '#FFFFFF' }}>
        {reel.vendor?.logo_url
          ? <Image source={{ uri: reel.vendor.logo_url }} style={{ width: 28, height: 28, borderRadius: 14 }} />
          : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={13} color="#E8521A" /></View>}
      </View>
      <View style={{ position: 'absolute', top: 10, right: 8 }}>
        <Ionicons name={isPhoto ? 'albums' : 'play'} size={14} color="#FFFFFF" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }} />
      </View>
      <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{reel.vendor?.business_name ?? 'Store'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
          <Ionicons name="eye-outline" size={11} color="rgba(255,255,255,0.85)" />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{formatCount(reel.view_count ?? 0)}</Text>
          {reel.distance_km != null && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}> · {reel.distance_km < 1 ? '<1' : Math.round(reel.distance_km)}km</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FeaturedCarousel({ vendors, width }: { vendors: Vendor[]; width: number }) {
  useTheme();
  const cardW = width - H_PAD * 2;
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const pausedUntil = useRef(0);

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  // Slides itself every few seconds; pauses for a while after you swipe
  useEffect(() => {
    if (!focused || vendors.length < 2) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIndex((i) => {
        const next = (i + 1) % vendors.length;
        ref.current?.scrollTo({ x: next * (cardW + 12), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [focused, vendors.length, cardW]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + 12)));
  };

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        decelerationRate="fast"
        snapToInterval={cardW + 12}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 12 }}
        onScrollBeginDrag={() => { pausedUntil.current = Date.now() + 8000; }}
        onMomentumScrollEnd={onScrollEnd}
      >
        {vendors.map((v) => <FeaturedCard key={v.id} vendor={v} width={cardW} />)}
      </ScrollView>
      {vendors.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }}>
          {vendors.map((v, i) => (
            <View key={v.id} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? T.primary : T.lineStrong }} />
          ))}
        </View>
      )}
    </View>
  );
}

function FeaturedCard({ vendor, width }: { vendor: Vendor; width: number }) {
  useTheme();
  const color = categoryColor(vendor.category);
  const open = isOpenNow(vendor);
  const content = (
    <>
      {/* bottom shade for legibility */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: open ? '#16A34A' : 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{open ? 'Open now' : 'Closed'}</Text>
        </View>
        <View style={{ backgroundColor: color, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{vendor.category}</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {vendor.logo_url
          ? <Image source={{ uri: vendor.logo_url }} style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' }} />
          : <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={22} color={color} /></View>}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{vendor.shop_name}</Text>
            {isVerified(vendor) && <Ionicons name="checkmark-circle" size={17} color="#4ADE80" />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
            {vendor.rating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{vendor.rating.toFixed(1)}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>({vendor.review_count})</Text>
              </View>
            )}
            {vendor.distance != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="navigate" size={11} color="rgba(255,255,255,0.9)" />
                <Text style={{ fontSize: 12.5, color: '#FFFFFF' }}>{formatDistance(vendor.distance)}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-forward" size={18} color="#1C1917" />
        </View>
      </View>
    </>
  );

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.92}
      accessibilityLabel={`Featured: ${vendor.shop_name}`}
      style={{ width, height: 210, borderRadius: 24, overflow: 'hidden', backgroundColor: color }}
    >
      {vendor.banner_url ? (
        <ImageBackground source={{ uri: vendor.banner_url }} style={{ flex: 1 }} resizeMode="cover">{content}</ImageBackground>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.12)', top: -60, right: -40 }} />
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

function LiveDot() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
      <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#15803D' }}>LIVE</Text>
    </View>
  );
}

function PromoBanner({ isVendor }: { isVendor: boolean }) {
  useTheme();
  const cfg = isVendor
    ? { title: 'Post to Reels', body: 'Share photos or a video of what you sell — buyers can chat to buy right from it.', cta: 'Create a post', icon: 'albums' as IoniconsName, go: () => router.push('/reel-upload') }
    : { title: 'Sell on Vendr', body: 'Open your free store in minutes and reach buyers near you.', cta: 'Open a store', icon: 'storefront' as IoniconsName, go: () => router.push('/become-vendor') };
  return (
    <TouchableOpacity onPress={cfg.go} activeOpacity={0.9} style={{ borderRadius: 24, backgroundColor: T.heroBg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(232,82,26,0.35)', right: -50, top: -60 }} />
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#E8521A', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={cfg.icon} size={24} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{cfg.title}</Text>
        <Text style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{cfg.body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFB38A' }}>{cfg.cta}</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFB38A" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function HomeSkeleton({ width }: { width: number }) {
  useTheme();
  const block = (w: number | string, h: number, r = 14, extra?: object) => (
    <View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: T.surface2 }, extra]} />
  );
  return (
    <View style={{ paddingHorizontal: H_PAD, marginTop: 28, gap: 12 }}>
      {block(140, 18, 6)}
      {block(width - H_PAD * 2, 210, 24)}
      <View style={{ height: 8 }} />
      {block(180, 18, 6)}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {block(156, 180, 18)}{block(156, 180, 18)}{block(60, 180, 18)}
      </View>
    </View>
  );
}

function EmptyState() {
  useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 50, paddingHorizontal: 40, gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="storefront-outline" size={32} color={T.primary} />
      </View>
      <Text style={{ color: T.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 }}>No stores here yet</Text>
      <Text style={{ color: T.ink3, fontSize: 13.5, textAlign: 'center', lineHeight: 19 }}>
        Vendors in your area haven't joined yet. Pull down to refresh, or open a store and be the first.
      </Text>
    </View>
  );
}
