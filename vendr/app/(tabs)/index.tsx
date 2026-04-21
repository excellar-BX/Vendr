// app/(tabs)/index.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { VendorCard } from '../../components/vendor/VendorCard';
import { HeroVendorCard } from '../../components/vendor/HeroVendorCard';
import { VendorRow } from '../../components/vendor/VendorRow';
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

// ─── Section config ──────────────────────────────────────────────────────────

interface Section {
  key: string;
  title: string;
  icon: IoniconsName;
  filter: (vendors: Vendor[]) => Vendor[];
}

const SECTIONS: Section[] = [
  {
    key: 'nearby',
    title: 'Closest to You',
    icon: 'location-outline',
    filter: (v) => v.filter(x => x.distance != null).slice(0, 8),
  },
  {
    key: 'top_rated',
    title: 'Top Rated',
    icon: 'star-outline',
    filter: (v) => [...v].sort((a, b) => b.rating - a.rating).filter(x => x.rating > 0).slice(0, 8),
  },
  {
    key: 'new',
    title: 'New on Vendr',
    icon: 'sparkles-outline',
    filter: (v) =>
      [...v]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
  },
  {
    key: 'has_reels',
    title: 'Has Reels',
    icon: 'play-circle-outline',
    filter: (v) => v.filter(x => x.has_reels).slice(0, 8),
  },
];

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { lat, lng, address, loading: locationLoading } = useLocation();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const userId = user?.id;
  const userName = user?.full_name?.split(' ')[0] ?? 'there';

  // Unread notif count
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      try {
        const response = await apiFetch('/notifications/unread-count', { method: 'GET' });
        setUnreadNotifs(response.data.count ?? 0);
      } catch (err) {
        console.error('Failed to fetch notifications count:', err);
      }
    };
    fetchUnread();
  }, [userId]));

  // Fetch & sort vendors
  const fetchVendors = useCallback(async () => {
    try {
      const response = await apiFetch('/vendors', { method: 'GET' });
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
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lat, lng]);

  useEffect(() => { fetchVendors(); }, [lat, lng]);

  const onRefresh = () => { setRefreshing(true); fetchVendors(); };

  // Filtered list shown when a category is active
  const filtered = activeCategory === 'All'
    ? []
    : vendors.filter(v => v.category === activeCategory);

  // Hero = first vendor (already sorted nearest-first or highest rated)
  const heroVendor = vendors[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Ambient glow top right */}
      <View
        style={{
          position: 'absolute', top: -40, right: -40,
          width: 220, height: 220, borderRadius: 110,
          backgroundColor: '#E8521A', opacity: 0.05,
        }}
      />

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
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9A8570', fontSize: 13, marginBottom: 2 }}>
                Good {getGreeting()}
              </Text>
              <Text style={{ color: '#FDF6EC', fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold' }}>
                Hey, {userName} 👋
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Ionicons name="location-outline" size={12} color="#6B5E50" />
                {locationLoading ? (
                  <Text style={{ color: '#6B5E50', fontSize: 12 }}>Getting location...</Text>
                ) : (
                  <Text style={{ color: '#6B5E50', fontSize: 12 }} numberOfLines={1}>
                    {address ?? 'Lagos, Nigeria'}
                  </Text>
                )}
              </View>
            </View>

            {/* Notif bell */}
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
        </View>

        {/* ── Search bar ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push('/search')}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#1A1208',
              borderWidth: 1,
              borderColor: '#2A1F14',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          >
            <Ionicons name="search-outline" size={18} color="#6B5E50" />
            <Text style={{ color: '#6B5E50', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, flex: 1 }}>
              Search vendors, products...
            </Text>
            <View
              style={{
                backgroundColor: '#2A1F14',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#6B5E50', fontSize: 11 }}>⌘K</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Category pills ──────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 20 }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setActiveCategory(cat.label)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: isActive ? '#E8521A' : '#1A1208',
                  borderWidth: 1,
                  borderColor: isActive ? '#E8521A' : '#2A1F14',
                }}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isActive ? 'white' : '#6B5E50'}
                />
                <Text
                  style={{
                    color: isActive ? 'white' : '#9A8570',
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

        {loading ? (
          // ── Loading state ──────────────────────────────────────────
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <ActivityIndicator size="large" color="#E8521A" />
            <Text style={{ color: '#6B5E50', fontSize: 13 }}>Finding vendors near you...</Text>
          </View>

        ) : activeCategory !== 'All' ? (
          // ── Category filtered list ─────────────────────────────────
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 }}>
                {activeCategory}
              </Text>
              <Text style={{ color: '#6B5E50', fontSize: 13 }}>{filtered.length} found</Text>
            </View>

            {filtered.length === 0 ? (
              <EmptyState category={activeCategory} />
            ) : (
              filtered.map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))
            )}
          </View>

        ) : (
          // ── Discovery mode (All) ───────────────────────────────────
          <View>
            {/* Hero card */}
            {heroVendor && (
              <View style={{ paddingHorizontal: 20 }}>
                <SectionHeader title="Featured" icon="flame-outline" />
                <HeroVendorCard vendor={heroVendor} />
              </View>
            )}

            {/* Carousel sections */}
            {SECTIONS.map((section) => {
              const sectionVendors = section.filter(vendors);
              if (sectionVendors.length === 0) return null;

              return (
                <View key={section.key} style={{ marginBottom: 28 }}>
                  <View style={{ paddingHorizontal: 20 }}>
                    <SectionHeader
                      title={section.title}
                      icon={section.icon}
                      onSeeAll={() => {
                        // Push to a filtered list screen or just scroll
                        // For now we trigger the matching category filter if applicable
                      }}
                      count={sectionVendors.length}
                    />
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 0 }}
                  >
                    {sectionVendors.map(vendor => (
                      <VendorRow key={vendor.id} vendor={vendor} width={156} />
                    ))}
                  </ScrollView>
                </View>
              );
            })}

            {/* All vendors at the bottom */}
            {vendors.length > 0 && (
              <View style={{ paddingHorizontal: 20 }}>
                <SectionHeader title="All Vendors" icon="storefront-outline" count={vendors.length} />
                {vendors.map(vendor => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </View>
            )}

            {vendors.length === 0 && <EmptyState />}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  onSeeAll,
  count,
}: {
  title: string;
  icon: IoniconsName;
  onSeeAll?: () => void;
  count?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: '#1A1208',
            borderWidth: 1,
            borderColor: '#2A1F14',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={14} color="#E8521A" />
        </View>
        <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 }}>
          {title}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {count != null && (
          <Text style={{ color: '#6B5E50', fontSize: 12 }}>{count}</Text>
        )}
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
            <Text style={{ color: '#E8521A', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 }}>
              See all
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function EmptyState({ category }: { category?: Category | 'All' }) {
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
        No vendors yet
      </Text>
      <Text style={{ color: '#6B5E50', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
        {!category || category === 'All'
          ? 'No vendors in your area yet. Check back soon!'
          : `No ${category} vendors nearby. Try another category.`}
      </Text>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}