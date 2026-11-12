import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl, Image, Dimensions,
  Modal, Pressable, Switch, KeyboardAvoidingView, Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '../../components/ui/StyledText';
import { searchApi, hashtagApi, HashtagSummary } from '../../lib/api';
import { openHashtag, formatCount } from '../../components/reel/ReelViewer';
import { useLocation } from '../../hooks/useLocation';
import { formatPrice, formatDistance } from '../../lib/utils';
import { getPlaceSuggestions } from '../../lib/geocoding';
import { Category } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { ReelCard } from '../../components/reel/ReelCard';
import {
  useSearchSuggestions,
  useSearchHistory,
  useSaveSearchHistory,
  useClearSearchHistory,
  useMyVendor,
} from '../../hooks/useQueries';
import { T, useTheme } from '../../constants/theme';
import { Fonts } from '../../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type ResultTab = 'all' | 'vendors' | 'products' | 'reels';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP) / 2;
const PAGE_SIZE = 50;
const DISTANCE_OPTIONS: (number | null)[] = [null, 2, 5, 10, 25];
const DEFAULT_DISTANCE = 10;
const RECENT_DEST_KEY = 'recent_destinations';

const CATEGORIES: { label: Category; icon: IoniconsName; color: string }[] = [
  { label: 'Food & Drinks', icon: 'fast-food-outline',      color: '#E8521A' },
  { label: 'Fashion',       icon: 'shirt-outline',          color: '#D97706' },
  { label: 'Accessories',   icon: 'diamond-outline',        color: '#78716C' },
  { label: 'Beauty & Hair', icon: 'cut-outline',            color: '#DB2777' },
  { label: 'Electronics',   icon: 'phone-portrait-outline', color: '#2563EB' },
  { label: 'Groceries',     icon: 'basket-outline',         color: '#2D8653' },
];
const categoryMeta = (label?: string | null) =>
  CATEGORIES.find((c) => c.label === label) ?? { label: 'Store', icon: 'storefront-outline' as IoniconsName, color: '#E8521A' };

interface Filters {
  category: Category | 'All';
  verifiedOnly: boolean;
  minRating: number;
  maxDistance: number | null; // km; null = any distance
}

interface Results {
  vendors: any[];
  products: any[];
  reels: any[];
  totals: { vendors: number; products: number; reels: number };
  didYouMean: string | null;
}

const EMPTY_RESULTS: Results = { vendors: [], products: [], reels: [], totals: { vendors: 0, products: 0, reels: 0 }, didYouMean: null };

function useDebounced<V>(value: V, ms: number): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { lat, lng } = useLocation();
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const inputRef = useRef<RNTextInput>(null);
  const requestId = useRef(0);

  // Query + mode
  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebounced(query, 250);

  // Filters
  const [filters, setFilters] = useState<Filters>({ category: 'All', verifiedOnly: false, minRating: 0, maxDistance: DEFAULT_DISTANCE });
  const [showFilters, setShowFilters] = useState(false);

  // Location
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const searchLat = destination?.lat ?? lat ?? null;
  const searchLng = destination?.lng ?? lng ?? null;
  const hasLocation = searchLat != null && searchLng != null;

  // Results
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [tab, setTab] = useState<ResultTab>('all');

  // Data hooks
  const { data: suggestionsData, isFetching: suggestionsLoading } = useSearchSuggestions(debouncedQuery);
  const { data: historyData, refetch: refetchHistory } = useSearchHistory();
  const { data: myVendor } = useMyVendor();
  const saveHistory = useSaveSearchHistory();
  const clearHistory = useClearSearchHistory();
  const recentSearches: string[] = user?.id ? (historyData ?? []) : [];

  useFocusEffect(useCallback(() => { if (user?.id) refetchHistory(); }, [refetchHistory, user?.id]));

  // ── Search ──────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (rawQ: string, overrides?: Partial<Filters>) => {
    const q = rawQ.trim();
    if (!q) return;
    const f = { ...filters, ...overrides };
    if (overrides) setFilters(f);

    const id = ++requestId.current;
    inputRef.current?.blur();
    setFocused(false);
    setQuery(q);
    setCommittedQuery(q);
    setHasSearched(true);
    setLoading(true);
    setTab('all');

    if (user?.id) saveHistory.mutate(q);

    try {
      const res = await searchApi.search({
        q,
        limit: PAGE_SIZE,
        ...(f.category !== 'All' && { category: f.category }),
        ...(f.verifiedOnly && { verified_only: true }),
        ...(f.minRating > 0 && { min_rating: f.minRating }),
        ...(hasLocation && { lat: searchLat!, lng: searchLng! }),
        ...(hasLocation && f.maxDistance != null && { max_distance: f.maxDistance }),
      });
      if (id !== requestId.current) return; // a newer search started — drop this response
      const d = res?.data ?? {};
      setResults({
        vendors: d.vendors ?? [],
        products: d.products ?? [],
        reels: d.reels ?? [],
        totals: {
          vendors: d.totalVendors ?? d.vendors?.length ?? 0,
          products: d.totalProducts ?? d.products?.length ?? 0,
          reels: d.totalReels ?? d.reels?.length ?? 0,
        },
        didYouMean: d.did_you_mean ?? null,
      });
    } catch (error: any) {
      if (id !== requestId.current) return;
      setResults(EMPTY_RESULTS);
      showAlert({ title: 'Search failed', message: error?.message || 'Something went wrong. Please try again.', type: 'danger' });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters, user?.id, hasLocation, searchLat, searchLng, saveHistory, showAlert]);

  // Re-run the current search when location changes
  const lastLocationKey = useRef('');
  useEffect(() => {
    const key = `${searchLat?.toFixed(3)},${searchLng?.toFixed(3)}`;
    if (lastLocationKey.current && key !== lastLocationKey.current && committedQuery) runSearch(committedQuery);
    lastLocationKey.current = key;
  }, [searchLat, searchLng]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    if (!committedQuery) return;
    setRefreshing(true);
    await runSearch(committedQuery);
    setRefreshing(false);
  }, [committedQuery, runSearch]);

  const resetSearch = () => {
    requestId.current++;
    setQuery('');
    setCommittedQuery('');
    setHasSearched(false);
    setResults(EMPTY_RESULTS);
    setLoading(false);
  };

  const cancelTyping = () => {
    inputRef.current?.blur();
    setFocused(false);
    setQuery(committedQuery); // restore the last searched text
  };

  const removeHistory = (item: string) => {
    clearHistory.mutate(item, {
      onError: () => showAlert({ title: 'Error', message: 'Could not remove that search.', type: 'danger' }),
    });
  };

  const openProduct = (p: any) => {
    router.push({ pathname: '/vendor/[id]', params: { id: p.vendor_id } });
  };
  const enquireProduct = (p: any) => {
    if (myVendor?.id === p.vendor_id) { router.push('/my-stores'); return; }
    router.push({
      pathname: '/chat/[conversationId]',
      params: { vendorId: p.vendor_id, productId: p.id, productName: p.name ?? '', productPrice: formatPrice(p.price ?? 0) },
    });
  };

  const activeFilterCount =
    (filters.verifiedOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (hasLocation && filters.maxDistance !== DEFAULT_DISTANCE ? 1 : 0);

  const totalCount = results.totals.vendors + results.totals.products + results.totals.reels;
  const mappable = results.vendors.filter((v) => v.vendor_lat != null && v.vendor_lng != null);
  const showMapFab = hasSearched && !loading && !focused && mappable.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      {alertElement}
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View style={{ paddingHorizontal: H_PAD, paddingTop: insets.top + 12, paddingBottom: 12, backgroundColor: T.canvas }}>
        {!focused && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: Fonts.extrabold, fontSize: 26, color: T.ink, letterSpacing: -0.5 }}>Search</Text>
            <TouchableOpacity
              onPress={() => setShowLocation(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Search location: ${destination ? destination.name : 'current location'}. Change`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: SCREEN_W * 0.55,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                backgroundColor: destination ? T.primarySoft : T.surface,
                borderWidth: 1, borderColor: destination ? T.primaryBorder : T.line,
              }}
            >
              <Ionicons name={destination ? 'location' : 'navigate'} size={14} color={destination ? T.primary : T.infoInk} />
              <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: 12, color: destination ? T.primaryInk : T.ink, flexShrink: 1 }}>
                {destination ? destination.name : hasLocation ? 'Near me' : 'Set location'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={T.ink3} />
            </TouchableOpacity>
          </View>
        )}

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: T.surface, borderWidth: 1.5,
              borderColor: focused ? T.primary : T.line,
              borderRadius: 16, paddingHorizontal: 14, height: 50,
            }}
          >
            <Ionicons name="search" size={18} color={focused ? T.primary : T.ink3} />
            <RNTextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onSubmitEditing={() => runSearch(query)}
              placeholder="Search vendors, products, reels"
              placeholderTextColor={T.ink3}
              selectionColor={T.primary}
              cursorColor={T.primary}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              accessibilityLabel="Search"
              style={{ flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: T.ink, paddingVertical: 0 }}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => { setQuery(''); if (!focused) resetSearch(); else inputRef.current?.focus(); }}
                hitSlop={10}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={T.ink4} />
              </TouchableOpacity>
            )}
          </View>

          {focused ? (
            <TouchableOpacity onPress={cancelTyping} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 15, color: T.primaryInk }}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
              style={{
                width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: activeFilterCount ? T.primary : T.surface,
                borderWidth: 1.5, borderColor: activeFilterCount ? T.primary : T.line,
              }}
            >
              <Ionicons name="options-outline" size={20} color={activeFilterCount ? '#FFFFFF' : T.ink} />
              {activeFilterCount > 0 && (
                <View style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
                  backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                  borderWidth: 2, borderColor: T.canvas,
                }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 10, color: T.canvas }}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips (results mode) */}
        {hasSearched && !focused && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12, marginHorizontal: -H_PAD, flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: H_PAD }}
          >
            {(['All', ...CATEGORIES.map((c) => c.label)] as (Category | 'All')[]).map((label) => {
              const active = filters.category === label;
              const meta = label === 'All' ? { icon: 'grid-outline' as IoniconsName } : categoryMeta(label);
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => runSearch(committedQuery, { category: label })}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: active ? T.ink : T.surface,
                    borderWidth: 1, borderColor: active ? T.ink : T.line,
                  }}
                >
                  <Ionicons name={meta.icon} size={13} color={active ? T.canvas : T.ink2} />
                  <Text style={{ fontFamily: active ? Fonts.semibold : Fonts.medium, fontSize: 12, color: active ? T.canvas : T.ink2 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Body */}
      {focused ? (
        <TypingPanel
          query={query}
          debouncedQuery={debouncedQuery}
          suggestions={suggestionsData}
          loading={suggestionsLoading}
          recentSearches={recentSearches}
          onSearch={(q) => runSearch(q)}
          onOpenVendor={(id) => { inputRef.current?.blur(); setFocused(false); router.push({ pathname: '/vendor/[id]', params: { id } }); }}
          onRemoveHistory={removeHistory}
          onClearHistory={() => clearHistory.mutate(undefined)}
          onPickCategory={(c) => runSearch(c, { category: c })}
          bottomInset={insets.bottom}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={hasSearched ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} /> : undefined}
        >
          {!hasSearched ? (
            <IdleState
              recentSearches={recentSearches}
              onSearch={(q) => runSearch(q)}
              onPickCategory={(c) => runSearch(c, { category: c })}
              onRemoveHistory={removeHistory}
              onClearHistory={() => clearHistory.mutate(undefined)}
            />
          ) : loading ? (
            <ResultsSkeleton />
          ) : totalCount === 0 ? (
            <NoResults
              query={committedQuery}
              didYouMean={results.didYouMean}
              radiusLimited={hasLocation && filters.maxDistance != null}
              radius={filters.maxDistance}
              filtersActive={filters.verifiedOnly || filters.minRating > 0 || filters.category !== 'All'}
              onDidYouMean={(q) => runSearch(q)}
              onWiden={() => runSearch(committedQuery, { maxDistance: null })}
              onClearFilters={() => runSearch(committedQuery, { category: 'All', verifiedOnly: false, minRating: 0 })}
            />
          ) : (
            <View>
              {/* Summary */}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4, marginBottom: 12 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 15, color: T.ink }}>
                  {totalCount} result{totalCount === 1 ? '' : 's'}
                </Text>
                <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink3 }}>
                  {' '}for “{committedQuery}”{hasLocation && filters.maxDistance != null ? ` · within ${filters.maxDistance} km` : ''}
                </Text>
              </View>

              {results.didYouMean && (
                <TouchableOpacity onPress={() => runSearch(results.didYouMean!)} style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink2 }}>
                    Did you mean <Text style={{ fontFamily: Fonts.semibold, color: T.primaryInk }}>{results.didYouMean}</Text>?
                  </Text>
                </TouchableOpacity>
              )}

              <ResultTabs tab={tab} onChange={setTab} totals={results.totals} />

              {tab === 'all' ? (
                <View style={{ gap: 24 }}>
                  {results.vendors.length > 0 && (
                    <Section title="Vendors" count={results.totals.vendors} onSeeAll={results.vendors.length > 4 ? () => setTab('vendors') : undefined}>
                      <Grid>{results.vendors.slice(0, 4).map((v) => <VendorCard key={v.id} vendor={v} />)}</Grid>
                    </Section>
                  )}
                  {results.products.length > 0 && (
                    <Section title="Products" count={results.totals.products} onSeeAll={results.products.length > 4 ? () => setTab('products') : undefined}>
                      <View style={{ gap: 10 }}>
                        {results.products.slice(0, 4).map((p) => (
                          <ProductRow key={p.id} product={p} onPress={() => openProduct(p)} onEnquire={() => enquireProduct(p)} />
                        ))}
                      </View>
                    </Section>
                  )}
                  {results.reels.length > 0 && (
                    <Section title="Reels" count={results.totals.reels} onSeeAll={results.reels.length > 4 ? () => setTab('reels') : undefined}>
                      <Grid>{results.reels.slice(0, 4).map((r) => <ReelCard key={r.id} reel={r} cardWidth={CARD_W} />)}</Grid>
                    </Section>
                  )}
                </View>
              ) : tab === 'vendors' ? (
                results.vendors.length ? <Grid>{results.vendors.map((v) => <VendorCard key={v.id} vendor={v} />)}</Grid> : <TabEmpty label="vendors" />
              ) : tab === 'products' ? (
                results.products.length ? (
                  <View style={{ gap: 10 }}>
                    {results.products.map((p) => (
                      <ProductRow key={p.id} product={p} onPress={() => openProduct(p)} onEnquire={() => enquireProduct(p)} />
                    ))}
                  </View>
                ) : <TabEmpty label="products" />
              ) : (
                results.reels.length ? <Grid>{results.reels.map((r) => <ReelCard key={r.id} reel={r} cardWidth={CARD_W} />)}</Grid> : <TabEmpty label="reels" />
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Map FAB */}
      {showMapFab && (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/map-search', params: { vendorIds: JSON.stringify(mappable.map((v) => v.id)), searchQuery: committedQuery } })}
          activeOpacity={0.9}
          accessibilityRole="button"
          style={{
            position: 'absolute', bottom: 24, alignSelf: 'center',
            height: 46, paddingHorizontal: 18, borderRadius: 999, backgroundColor: T.ink,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8,
          }}
        >
          <Ionicons name="map-outline" size={17} color={T.canvas} />
          <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: T.canvas }}>Map · {mappable.length}</Text>
        </TouchableOpacity>
      )}

      <FilterSheet
        visible={showFilters}
        initial={filters}
        hasLocation={hasLocation}
        onClose={() => setShowFilters(false)}
        onApply={(f) => {
          setShowFilters(false);
          if (committedQuery) runSearch(committedQuery, f); else setFilters(f);
        }}
      />

      <LocationSheet
        visible={showLocation}
        destination={destination}
        gpsAvailable={lat != null && lng != null}
        onClose={() => setShowLocation(false)}
        onUseGps={() => { setDestination(null); setShowLocation(false); }}
        onPick={(d) => { setDestination(d); setShowLocation(false); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing panel: recent searches (empty input) or live suggestions
// ─────────────────────────────────────────────────────────────────────────────

function TypingPanel({
  query, debouncedQuery, suggestions, loading, recentSearches,
  onSearch, onOpenVendor, onRemoveHistory, onClearHistory, onPickCategory, bottomInset,
}: {
  query: string;
  debouncedQuery: string;
  suggestions: any;
  loading: boolean;
  recentSearches: string[];
  onSearch: (q: string) => void;
  onOpenVendor: (id: string) => void;
  onRemoveHistory: (q: string) => void;
  onClearHistory: () => void;
  onPickCategory: (c: Category) => void;
  bottomInset: number;
}) {
  useTheme();
  const q = query.trim();

  const rows = useMemo(() => {
    if (!q || !suggestions || debouncedQuery.trim() !== q) return null;
    const out: { key: string; kind: 'history' | 'trending' | 'product' | 'vendor'; label: string; sub?: string; image?: string; id?: string }[] = [];
    (suggestions.history ?? []).forEach((h: string) => out.push({ key: `h-${h}`, kind: 'history', label: h }));
    (suggestions.vendors ?? []).forEach((v: any) => out.push({
      key: `v-${v.id}`, kind: 'vendor', label: v.business_name, id: v.id, image: v.logo_url ?? undefined,
      sub: [v.category, v.rating > 0 ? `★ ${Number(v.rating).toFixed(1)}` : null].filter(Boolean).join(' · '),
    }));
    (suggestions.products ?? []).forEach((p: any) => out.push({
      key: `p-${p.id}`, kind: 'product', label: p.name, image: p.image_url ?? undefined, sub: formatPrice(p.price ?? 0),
    }));
    (suggestions.trending ?? []).forEach((t: string) => out.push({ key: `t-${t}`, kind: 'trending', label: t }));
    return out;
  }, [q, suggestions, debouncedQuery]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: bottomInset + 40 }}
      >
        {!q ? (
          <IdleState
            recentSearches={recentSearches}
            onSearch={onSearch}
            onPickCategory={onPickCategory}
            onRemoveHistory={onRemoveHistory}
            onClearHistory={onClearHistory}
            compact
          />
        ) : (
          <View style={{ backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}>
            {/* Always offer the literal query first */}
            <SuggestionRow icon="search" iconColor={T.primary} iconBg={T.primarySoft} label={`Search “${q}”`} bold onPress={() => onSearch(q)} />
            {/^#?[\p{L}\p{N}_]+$/u.test(q) && /\p{L}/u.test(q) && (
              <SuggestionRow
                icon="pricetag-outline" iconColor={T.goldInk} iconBg={T.goldSoft}
                label={`See posts tagged #${q.replace(/^#/, '').toLowerCase()}`}
                onPress={() => openHashtag(q.replace(/^#/, ''))}
              />
            )}

            {rows === null && loading && (
              <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink3 }}>Looking for matches…</Text>
              </View>
            )}

            {rows?.map((r) => (
              <SuggestionRow
                key={r.key}
                icon={r.kind === 'history' ? 'time-outline' : r.kind === 'trending' ? 'trending-up' : r.kind === 'vendor' ? 'storefront-outline' : 'cube-outline'}
                iconColor={r.kind === 'trending' ? T.goldInk : T.ink2}
                iconBg={r.kind === 'trending' ? T.goldSoft : T.surface2}
                image={r.image}
                label={r.label}
                highlight={q}
                sub={r.sub}
                trailing={r.kind === 'vendor' ? 'chevron-forward' : 'arrow-up-outline'}
                onPress={() => (r.kind === 'vendor' && r.id ? onOpenVendor(r.id) : onSearch(r.label))}
              />
            ))}

            {rows && rows.length === 0 && (
              <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink3 }}>No quick matches — press search to look everywhere.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SuggestionRow({
  icon, iconColor, iconBg, image, label, highlight, sub, bold, trailing, onPress,
}: {
  icon: IoniconsName; iconColor: string; iconBg: string; image?: string;
  label: string; highlight?: string; sub?: string; bold?: boolean; trailing?: IoniconsName; onPress: () => void;
}) {
  useTheme();
  // Bold the part of the label that matches what the user typed
  const idx = highlight ? label.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: T.line, marginTop: -1 }}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.surface2 }} />
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: bold ? Fonts.semibold : Fonts.regular, fontSize: 14, color: T.ink }}>
          {idx >= 0 ? (
            <>
              {label.slice(0, idx)}
              <Text style={{ fontFamily: Fonts.bold, color: T.ink }}>{label.slice(idx, idx + highlight!.length)}</Text>
              {label.slice(idx + highlight!.length)}
            </>
          ) : label}
        </Text>
        {sub ? <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {trailing && <Ionicons name={trailing} size={16} color={T.ink4} style={trailing === 'arrow-up-outline' ? { transform: [{ rotate: '-45deg' }] } : undefined} />}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trending hashtags (shown when the search box is empty)
// ─────────────────────────────────────────────────────────────────────────────

let trendingCache: HashtagSummary[] | null = null;

function TrendingHashtags() {
  useTheme();
  const [tags, setTags] = useState<HashtagSummary[]>(trendingCache ?? []);
  useEffect(() => {
    hashtagApi.trending(12)
      .then(({ data }) => { trendingCache = data ?? []; setTags(trendingCache!); })
      .catch(() => {});
  }, []);
  if (tags.length === 0) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Ionicons name="trending-up" size={16} color={T.goldInk} />
        <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: T.ink }}>Trending hashtags</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((t) => (
          <TouchableOpacity
            key={t.tag}
            onPress={() => openHashtag(t.tag)}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}
          >
            <Text style={{ fontFamily: Fonts.bold, fontSize: 13, color: T.ink }}>#{t.tag}</Text>
            <Text style={{ fontSize: 11.5, color: T.ink3 }}>{formatCount(t.post_count)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Idle state: categories + recent searches
// ─────────────────────────────────────────────────────────────────────────────

function IdleState({
  recentSearches, onSearch, onPickCategory, onRemoveHistory, onClearHistory, compact,
}: {
  recentSearches: string[];
  onSearch: (q: string) => void;
  onPickCategory: (c: Category) => void;
  onRemoveHistory: (q: string) => void;
  onClearHistory: () => void;
  compact?: boolean;
}) {
  useTheme();
  const recent = recentSearches.slice(0, compact ? 6 : 8);
  return (
    <View style={{ gap: 28, paddingTop: 4 }}>
      <TrendingHashtags />
      {recent.length > 0 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: T.ink }}>Recent</Text>
            <TouchableOpacity onPress={onClearHistory} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: T.primaryInk }}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recent.map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: T.line }}>
              <TouchableOpacity
                onPress={() => onSearch(s)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${s}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }}
              >
                <Ionicons name="time-outline" size={17} color={T.ink3} />
                <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 15, color: T.ink, flex: 1 }}>{s}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemoveHistory(s)} hitSlop={10} accessibilityLabel={`Remove ${s} from recent searches`} style={{ padding: 6 }}>
                <Ionicons name="close" size={16} color={T.ink4} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: T.ink, marginBottom: 12 }}>Browse categories</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.label}
              onPress={() => onPickCategory(c.label)}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                width: CARD_W, flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
                borderRadius: 16, paddingHorizontal: 12, paddingVertical: 14,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${c.color}1F`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={c.icon} size={18} color={c.color} />
              </View>
              <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: 13, color: T.ink, flexShrink: 1 }}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Results building blocks
// ─────────────────────────────────────────────────────────────────────────────

function ResultTabs({ tab, onChange, totals }: { tab: ResultTab; onChange: (t: ResultTab) => void; totals: Results['totals'] }) {
  useTheme();
  const tabs: { key: ResultTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'vendors', label: 'Vendors', count: totals.vendors },
    { key: 'products', label: 'Products', count: totals.products },
    { key: 'reels', label: 'Reels', count: totals.reels },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: T.surface2, borderRadius: 14, padding: 4, marginBottom: 18 }}>
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10,
              backgroundColor: active ? T.surface : 'transparent',
              ...(active ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 } : {}),
            }}
          >
            <Text numberOfLines={1} style={{ fontFamily: active ? Fonts.semibold : Fonts.medium, fontSize: 12, color: active ? T.ink : T.ink3 }}>
              {t.label}{t.count != null ? ` ${t.count}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Section({ title, count, onSeeAll, children }: { title: string; count: number; onSeeAll?: () => void; children: React.ReactNode }) {
  useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 17, color: T.ink }}>
          {title} <Text style={{ fontFamily: Fonts.medium, fontSize: 14, color: T.ink3 }}>{count}</Text>
        </Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: T.primaryInk }}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>{children}</View>;
}

function VendorCard({ vendor }: { vendor: any }) {
  useTheme();
  const meta = categoryMeta(vendor.vendor_category);
  const cover = vendor.vendor_banner_url ?? vendor.vendor_logo_url;
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.vendor_shop_name ?? 'Vendor'}, ${vendor.vendor_category ?? ''}`}
      style={{ width: CARD_W, backgroundColor: T.surface, borderRadius: 18, borderWidth: 1, borderColor: T.line, overflow: 'hidden' }}
    >
      <View style={{ height: 92, backgroundColor: `${meta.color}14`, alignItems: 'center', justifyContent: 'center' }}>
        {cover
          ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Ionicons name={meta.icon} size={26} color={meta.color} />}
        {vendor.vendor_is_verified && (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: T.success, borderRadius: 999, padding: 3 }}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        )}
        {vendor.vendor_logo_url && vendor.vendor_banner_url && (
          <Image
            source={{ uri: vendor.vendor_logo_url }}
            style={{ position: 'absolute', bottom: -14, left: 10, width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: T.surface }}
          />
        )}
      </View>
      <View style={{ padding: 10, paddingTop: vendor.vendor_logo_url && vendor.vendor_banner_url ? 18 : 10, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: Fonts.bold, fontSize: 14, color: T.ink }}>{vendor.vendor_shop_name || 'Vendor'}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3 }}>{vendor.vendor_category ?? 'Store'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={11} color={T.gold} />
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: T.ink }}>
              {vendor.vendor_rating > 0 ? Number(vendor.vendor_rating).toFixed(1) : 'New'}
            </Text>
          </View>
          {vendor.distance != null && (
            <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: T.ink3 }}>{formatDistance(vendor.distance)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ProductRow({ product, onPress, onEnquire }: { product: any; onPress: () => void; onEnquire: () => void }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPrice(product.price ?? 0)}, from ${product.vendor_shop_name ?? 'vendor'}`}
      style={{ flexDirection: 'row', gap: 12, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 10 }}
    >
      <View style={{ width: 76, height: 76, borderRadius: 12, overflow: 'hidden', backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' }}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Ionicons name="cube-outline" size={24} color={T.ink4} />}
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
        <View>
          <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: 14, color: T.ink }}>{product.name}</Text>
          <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3, marginTop: 2 }}>
            {product.vendor_shop_name ?? 'Vendor'}{product.distance != null ? ` · ${formatDistance(product.distance)}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: Fonts.extrabold, fontSize: 15, color: T.ink }}>{formatPrice(product.price ?? 0)}</Text>
          <TouchableOpacity
            onPress={onEnquire}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Ask about ${product.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: T.primarySoft }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={T.primaryInk} />
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: T.primaryInk }}>Ask</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TabEmpty({ label }: { label: string }) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontFamily: Fonts.regular, fontSize: 14, color: T.ink3 }}>No {label} for this search.</Text>
    </View>
  );
}

function ResultsSkeleton() {
  useTheme();
  const block = (w: number | string, h: number, r = 8) => (
    <View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: T.surface2 }} />
  );
  return (
    <View style={{ gap: 16, paddingTop: 4 }} accessibilityLabel="Searching" accessible>
      {block(160, 16)}
      {block('100%', 38, 14)}
      <Grid>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: CARD_W, borderRadius: 18, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, overflow: 'hidden' }}>
            {block('100%', 92, 0)}
            <View style={{ padding: 10, gap: 6 }}>{block('80%', 12)}{block('50%', 10)}</View>
          </View>
        ))}
      </Grid>
    </View>
  );
}

function NoResults({
  query, didYouMean, radiusLimited, radius, filtersActive, onDidYouMean, onWiden, onClearFilters,
}: {
  query: string; didYouMean: string | null; radiusLimited: boolean; radius: number | null; filtersActive: boolean;
  onDidYouMean: (q: string) => void; onWiden: () => void; onClearFilters: () => void;
}) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 12, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="search-outline" size={28} color={T.ink3} />
      </View>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 18, color: T.ink }}>No results for “{query}”</Text>
      <Text style={{ fontFamily: Fonts.regular, fontSize: 14, color: T.ink2, textAlign: 'center' }}>
        {radiusLimited ? `Nothing within ${radius} km. Try a wider area or a different word.` : 'Check the spelling or try a more general word.'}
      </Text>

      <View style={{ gap: 10, marginTop: 10, alignSelf: 'stretch' }}>
        {didYouMean && (
          <TouchableOpacity onPress={() => onDidYouMean(didYouMean)} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: T.primarySoft }}>
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 14, color: T.primaryInk }}>Search “{didYouMean}” instead</Text>
          </TouchableOpacity>
        )}
        {radiusLimited && (
          <TouchableOpacity onPress={onWiden} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: T.primary }}>
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 14, color: '#FFFFFF' }}>Search everywhere</Text>
          </TouchableOpacity>
        )}
        {filtersActive && (
          <TouchableOpacity onPress={onClearFilters} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: T.lineStrong }}>
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 14, color: T.ink }}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom sheets
// ─────────────────────────────────────────────────────────────────────────────

function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: T.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: H_PAD, paddingTop: 10, paddingBottom: insets.bottom + 16, maxHeight: '85%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 18, color: T.ink }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={T.ink2} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FilterSheet({ visible, initial, hasLocation, onClose, onApply }: {
  visible: boolean; initial: Filters; hasLocation: boolean; onClose: () => void; onApply: (f: Filters) => void;
}) {
  useTheme();
  const [draft, setDraft] = useState(initial);
  useEffect(() => { if (visible) setDraft(initial); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (active: boolean, label: React.ReactNode, onPress: () => void, disabled = false, key?: string) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
        backgroundColor: active ? T.ink : T.surface, borderWidth: 1, borderColor: active ? T.ink : T.lineStrong,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </TouchableOpacity>
  );
  const chipText = (active: boolean, s: string) => (
    <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: active ? T.canvas : T.ink }}>{s}</Text>
  );
  const label = (s: string) => (
    <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: T.ink3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>{s}</Text>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Filters">
      <View style={{ gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Ionicons name="shield-checkmark" size={18} color={T.success} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 15, color: T.ink }}>Verified vendors only</Text>
              <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3 }}>ID-checked sellers</Text>
            </View>
          </View>
          <Switch
            value={draft.verifiedOnly}
            onValueChange={(v) => setDraft({ ...draft, verifiedOnly: v })}
            trackColor={{ false: T.lineStrong, true: T.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={T.lineStrong}
          />
        </View>

        <View>
          {label('Minimum rating')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[0, 3, 4, 4.5].map((r) => {
              const active = draft.minRating === r;
              return chip(active, r === 0 ? chipText(active, 'Any') : (
                <>
                  <Ionicons name="star" size={12} color={active ? T.canvas : T.gold} />
                  {chipText(active, `${r}+`)}
                </>
              ), () => setDraft({ ...draft, minRating: r }), false, `r-${r}`);
            })}
          </View>
        </View>

        <View>
          {label('Distance')}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {DISTANCE_OPTIONS.map((d) => {
              const active = draft.maxDistance === d;
              return chip(active, chipText(active, d == null ? 'Any' : `${d} km`), () => setDraft({ ...draft, maxDistance: d }), !hasLocation && d != null, `d-${d}`);
            })}
          </View>
          {!hasLocation && (
            <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3, marginTop: 8 }}>
              Turn on location or pick a place to filter by distance.
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => setDraft({ category: draft.category, verifiedOnly: false, minRating: 0, maxDistance: DEFAULT_DISTANCE })}
            style={{ flex: 1, height: 52, borderRadius: 14, borderWidth: 1, borderColor: T.lineStrong, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: Fonts.semibold, fontSize: 15, color: T.ink }}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onApply(draft)}
            style={{ flex: 2, height: 52, borderRadius: 14, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: Fonts.bold, fontSize: 15, color: '#FFFFFF' }}>Show results</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Sheet>
  );
}

function LocationSheet({ visible, destination, gpsAvailable, onClose, onUseGps, onPick }: {
  visible: boolean;
  destination: { name: string } | null;
  gpsAvailable: boolean;
  onClose: () => void;
  onUseGps: () => void;
  onPick: (d: { name: string; lat: number; lng: number }) => void;
}) {
  useTheme();
  const [text, setText] = useState('');
  const [places, setPlaces] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const debounced = useDebounced(text, 300);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(RECENT_DEST_KEY).then((s) => { try { setRecent(s ? JSON.parse(s) : []); } catch { setRecent([]); } }).catch(() => {});
  }, [visible]);

  useEffect(() => {
    let alive = true;
    if (debounced.trim().length < 2) { setPlaces([]); return; }
    getPlaceSuggestions(debounced.trim()).then((r) => { if (alive) setPlaces(r ?? []); }).catch(() => { if (alive) setPlaces([]); });
    return () => { alive = false; };
  }, [debounced]);

  const choose = async (p: any) => {
    const d = { name: String(p.display_name).split(',')[0], lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
    if (Number.isNaN(d.lat) || Number.isNaN(d.lng)) return;
    const updated = [p, ...recent.filter((r) => r.place_id !== p.place_id)].slice(0, 5);
    setRecent(updated);
    AsyncStorage.setItem(RECENT_DEST_KEY, JSON.stringify(updated)).catch(() => {});
    setText('');
    onPick(d);
  };

  const placeRow = (p: any, icon: IoniconsName) => (
    <TouchableOpacity
      key={p.place_id}
      onPress={() => choose(p)}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line }}
    >
      <Ionicons name={icon} size={17} color={T.ink3} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: 14, color: T.ink }}>{String(p.display_name).split(',')[0]}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3 }}>{String(p.display_name).split(',').slice(1).join(',').trim()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Search near">
      <TouchableOpacity
        onPress={onUseGps}
        disabled={!gpsAvailable}
        accessibilityRole="button"
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 14,
          backgroundColor: !destination ? T.infoSoft : T.surface2, opacity: gpsAvailable ? 1 : 0.5,
        }}
      >
        <Ionicons name="navigate" size={18} color={T.infoInk} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.semibold, fontSize: 15, color: T.ink }}>My current location</Text>
          <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3 }}>{gpsAvailable ? 'Uses your device GPS' : 'Location is off or unavailable'}</Text>
        </View>
        {!destination && gpsAvailable && <Ionicons name="checkmark-circle" size={20} color={T.infoInk} />}
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: text ? T.primary : T.lineStrong, backgroundColor: T.surface }}>
        <Ionicons name="search" size={16} color={T.ink3} />
        <RNTextInput
          value={text}
          onChangeText={setText}
          placeholder="Area, street or landmark (e.g. Ikeja)"
          placeholderTextColor={T.ink3}
          selectionColor={T.primary}
          style={{ flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: T.ink, paddingVertical: 0 }}
          underlineColorAndroid="transparent"
          accessibilityLabel="Search for a place"
        />
        {text.length > 0 && (
          <TouchableOpacity onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear place search">
            <Ionicons name="close-circle" size={18} color={T.ink4} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ marginTop: 6 }} keyboardShouldPersistTaps="handled">
        {text.trim().length >= 2
          ? places.map((p) => placeRow(p, 'location-outline'))
          : recent.length > 0 && (
              <>
                <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: T.ink3, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12 }}>Recent places</Text>
                {recent.map((p) => placeRow(p, 'time-outline'))}
              </>
            )}
      </ScrollView>
    </Sheet>
  );
}
