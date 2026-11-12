import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity, RefreshControl,
  TextInput as RNTextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { VendorCard } from '../../components/vendor/VendorCard';
import { apiFetch } from '../../lib/api';
import { calcDistance } from '../../lib/utils';
import { Vendor, Category } from '../../types';
import { useLocation } from '../../hooks/useLocation';
import { T, useTheme } from '../../constants/theme';
import { Fonts } from '../../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type SortKey = 'distance' | 'rating' | 'newest';

const SORTS: { key: SortKey; label: string; icon: IoniconsName; title: string }[] = [
  { key: 'distance', label: 'Nearest',   icon: 'navigate-outline', title: 'Closest to You' },
  { key: 'rating',   label: 'Top rated', icon: 'star-outline',     title: 'Top Rated' },
  { key: 'newest',   label: 'Newest',    icon: 'sparkles-outline', title: 'New on Vendr' },
];

const CATEGORIES: { label: Category | 'All'; icon: IoniconsName; color: string }[] = [
  { label: 'All',           icon: 'grid-outline',           color: '#E8521A' },
  { label: 'Food & Drinks', icon: 'fast-food-outline',      color: '#E8521A' },
  { label: 'Fashion',       icon: 'shirt-outline',          color: '#D97706' },
  { label: 'Accessories',   icon: 'diamond-outline',        color: '#78716C' },
  { label: 'Beauty & Hair', icon: 'cut-outline',            color: '#DB2777' },
  { label: 'Electronics',   icon: 'phone-portrait-outline', color: '#2563EB' },
  { label: 'Groceries',     icon: 'basket-outline',         color: '#2D8653' },
];

export default function VendorListScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sort?: SortKey; category?: string }>();
  const { lat, lng, loading: locationLoading } = useLocation();
  const hasLocation = lat != null && lng != null;

  const initialSort: SortKey = SORTS.some((s) => s.key === params.sort) ? (params.sort as SortKey) : 'distance';
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [category, setCategory] = useState<Category | 'All'>(
    (CATEGORIES.find((c) => c.label === params.category)?.label ?? 'All') as Category | 'All',
  );
  const [text, setText] = useState('');
  const [raw, setRaw] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVendors = useCallback(async () => {
    setFailed(false);
    try {
      const response = await apiFetch('/vendors', { method: 'GET' });
      setRaw(response?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // Distance only when BOTH the user and the vendor have real coordinates
  const vendors = useMemo(() => {
    const q = text.trim().toLowerCase();
    let list: Vendor[] = raw.map((v) => ({
      ...v,
      distance: hasLocation && v.lat != null && v.lng != null ? calcDistance(lat!, lng!, v.lat, v.lng) : undefined,
    }));
    if (category !== 'All') list = list.filter((v) => v.category === category);
    if (q) {
      list = list.filter((v) =>
        v.shop_name?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q));
    }
    const effectiveSort = sort === 'distance' && !hasLocation ? 'rating' : sort;
    if (effectiveSort === 'distance') list.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
    else if (effectiveSort === 'rating') list.sort((a, b) => (b.rating - a.rating) || (b.review_count - a.review_count));
    else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [raw, text, category, sort, hasLocation, lat, lng]);

  const title = text.trim()
    ? 'Matching vendors'
    : category !== 'All' ? category : SORTS.find((s) => s.key === sort)!.title;

  const header = (
    <View style={{ paddingBottom: 6 }}>
      {/* Search within list */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 16,
        backgroundColor: T.surface, borderWidth: 1.5, borderColor: text ? T.primary : T.line,
      }}>
        <Ionicons name="search" size={17} color={text ? T.primary : T.ink3} />
        <RNTextInput
          value={text}
          onChangeText={setText}
          placeholder="Filter by name, category or area"
          placeholderTextColor={T.ink3}
          selectionColor={T.primary}
          autoCorrect={false}
          returnKeyType="search"
          underlineColorAndroid="transparent"
          accessibilityLabel="Filter vendors"
          style={{ flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: T.ink, paddingVertical: 0 }}
        />
        {text.length > 0 && (
          <TouchableOpacity onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear filter">
            <Ionicons name="close-circle" size={18} color={T.ink4} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort */}
      <View style={{ flexDirection: 'row', backgroundColor: T.surface2, borderRadius: 14, padding: 4, marginTop: 12 }}>
        {SORTS.map((s) => {
          const active = sort === s.key;
          const disabled = s.key === 'distance' && !hasLocation && !locationLoading;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSort(s.key)}
              disabled={disabled}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                paddingVertical: 9, borderRadius: 10, opacity: disabled ? 0.4 : 1,
                backgroundColor: active ? T.surface : 'transparent',
                ...(active ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 } : {}),
              }}
            >
              <Ionicons name={s.icon} size={13} color={active ? T.primary : T.ink3} />
              <Text style={{ fontFamily: active ? Fonts.semibold : Fonts.medium, fontSize: 12, color: active ? T.ink : T.ink3 }}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 12, marginHorizontal: -20, flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      >
        {CATEGORIES.map((c) => {
          const active = category === c.label;
          return (
            <TouchableOpacity
              key={c.label}
              onPress={() => setCategory(c.label)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: active ? T.ink : T.surface, borderWidth: 1, borderColor: active ? T.ink : T.line,
              }}
            >
              <Ionicons name={c.icon} size={14} color={active ? T.canvas : c.label === 'All' ? T.ink2 : c.color} />
              <Text style={{ fontFamily: active ? Fonts.semibold : Fonts.medium, fontSize: 12, color: active ? T.canvas : T.ink }}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!loading && !failed && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 18, color: T.ink }}>{title}</Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: T.ink3 }}>
            {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
          </Text>
        </View>
      )}
      {sort === 'distance' && !hasLocation && !locationLoading && (
        <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3, marginTop: -6, marginBottom: 12 }}>
          Location is off — showing top rated instead.
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      {/* App bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: T.canvas,
      }}>
        <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
        <Text style={{ flex: 1, fontFamily: Fonts.extrabold, fontSize: 22, color: T.ink, letterSpacing: -0.4 }}>Vendors</Text>
        <IconButton icon="map-outline" label="View vendors on map" onPress={() => router.push('/map-search')} />
      </View>

      <FlatList
        data={loading || failed ? [] : vendors}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VendorCard vendor={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? <ListSkeleton /> : failed ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn’t load vendors"
              body="Check your connection and try again."
              action={{ label: 'Try again', onPress: () => { setLoading(true); fetchVendors(); } }}
            />
          ) : (
            <EmptyState
              icon="storefront-outline"
              title="No vendors found"
              body={text || category !== 'All' ? 'Try a different word or category.' : 'Check back soon — new vendors join every day.'}
              action={text || category !== 'All' ? { label: 'Clear filters', onPress: () => { setText(''); setCategory('All'); } } : undefined}
            />
          )
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVendors(); }} tintColor={T.primary} colors={[T.primary]} />
        }
      />
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: IoniconsName; label: string; onPress: () => void }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={20} color={T.ink} />
    </TouchableOpacity>
  );
}

function ListSkeleton() {
  useTheme();
  return (
    <View style={{ gap: 16, marginTop: 20 }} accessible accessibilityLabel="Loading vendors">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}>
          <View style={{ height: 144, backgroundColor: T.surface2 }} />
          <View style={{ padding: 16, gap: 8 }}>
            <View style={{ width: '60%', height: 14, borderRadius: 7, backgroundColor: T.surface2 }} />
            <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: T.surface2 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ icon, title, body, action }: {
  icon: IoniconsName; title: string; body: string; action?: { label: string; onPress: () => void };
}) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 56, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={28} color={T.ink3} />
      </View>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 17, color: T.ink }}>{title}</Text>
      <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink2, textAlign: 'center', paddingHorizontal: 32 }}>{body}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} style={{ marginTop: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999, backgroundColor: T.primary }}>
          <Text style={{ fontFamily: Fonts.semibold, fontSize: 14, color: '#FFFFFF' }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
