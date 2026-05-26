import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Image, Dimensions,
  TextInput as RNTextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { searchApi } from '../../lib/api';
import { useLocation } from '../../hooks/useLocation';
import { calcDistance, formatPrice, formatDistance } from '../../lib/utils';
import { getPlaceSuggestions } from '../../lib/geocoding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vendor, Product, Category } from '../../types';
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

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - 40 - CARD_GAP) / 2;

const CATEGORIES: { label: Category | 'All'; icon: IoniconsName }[] = [
  { label: 'All',           icon: 'grid-outline' },
  { label: 'Food & Drinks', icon: 'fast-food-outline' },
  { label: 'Fashion',       icon: 'shirt-outline' },
  { label: 'Accessories',   icon: 'diamond-outline' },
  { label: 'Beauty & Hair', icon: 'cut-outline' },
  { label: 'Electronics',   icon: 'phone-portrait-outline' },
  { label: 'Groceries',     icon: 'basket-outline' },
];

const categoryConfig: Record<string, { color: string; icon: IoniconsName }> = {
  'Food & Drinks':  { color: '#E8521A', icon: 'fast-food-outline' },
  'Fashion':        { color: '#F5A623', icon: 'shirt-outline' },
  'Accessories':    { color: '#9A8570', icon: 'diamond-outline' },
  'Beauty & Hair':  { color: '#E85599', icon: 'cut-outline' },
  'Electronics':    { color: '#5599E8', icon: 'phone-portrait-outline' },
  'Groceries':      { color: '#2D8653', icon: 'basket-outline' },
};

// ── Suggestion row types ────────────────────────────────────────────────────
type SuggestionSource = 'history' | 'trending' | 'product' | 'vendor';

interface SuggestionRow {
  key: string;
  source: SuggestionSource;
  label: string;        // main text shown in the row
  subtitle?: string;    // e.g. price or category
  image_url?: string;
  rating?: number;
}

// ── Search result item ───────────────────────────────────────────────────────
type SearchResultItem = {
  id: string;
  type: 'vendor' | 'product' | 'reel';
  vendor_id: string;
  vendor_shop_name: string | null;
  vendor_category: string | null;
  vendor_lat: number | null;
  vendor_lng: number | null;
  vendor_logo_url: string | null;
  vendor_banner_url: string | null;
  vendor_avatar_url: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  vendor_whatsapp: string | null;
  vendor_instagram: string | null;
  vendor_twitter: string | null;
  vendor_open_days: string[] | null;
  vendor_open_time: string | null;
  vendor_close_time: string | null;
  vendor_city: string | null;
  vendor_is_verified: boolean | null;
  vendor_rating: number | null;
  vendor_review_count: number | null;
  name: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  product_id: string | null;
  score: number;
  distance: number | null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function VendorGridCard({ vendor }: { vendor: any }) {
  const cfg = categoryConfig[vendor.vendor_category ?? ''] ?? { color: '#E8521A', icon: 'storefront-outline' as IoniconsName };
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.88}
      style={{
        width: CARD_W, backgroundColor: '#1A1208', borderRadius: 20,
        borderWidth: 1, borderColor: '#2A1F14', overflow: 'hidden', marginBottom: CARD_GAP,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
      }}
    >
      <View style={{ height: 96, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {vendor.vendor_banner_url
          ? <Image source={{ uri: vendor.vendor_banner_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : vendor.vendor_logo_url
            ? <Image source={{ uri: vendor.vendor_logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${cfg.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={cfg.icon} size={22} color={cfg.color} />
              </View>
        }
        {vendor.vendor_is_verified && (
          <View style={{
            position: 'absolute', top: 8, right: 8,
            backgroundColor: 'rgba(45,134,83,0.2)', borderRadius: 8,
            borderWidth: 1, borderColor: 'rgba(45,134,83,0.4)',
            paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3,
          }}>
            <Ionicons name="checkmark-circle" size={10} color="#2D8653" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 9, color: '#2D8653' }}>Verified</Text>
          </View>
        )}
        {vendor.vendor_logo_url && (
          <View style={{ position: 'absolute', bottom: -16, left: 10 }}>
            <Image source={{ uri: vendor.vendor_logo_url }} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: '#1A1208' }} resizeMode="cover" />
          </View>
        )}
      </View>
      <View style={{ padding: 10, paddingTop: vendor.vendor_logo_url ? 22 : 10, gap: 4 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#FDF6EC' }} numberOfLines={1}>{vendor.vendor_shop_name || 'Unknown Store'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={cfg.icon} size={10} color={cfg.color} />
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }} numberOfLines={1}>{vendor.vendor_category ?? 'Store'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={10} color="#F5A623" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#FDF6EC' }}>
              {vendor.vendor_rating && vendor.vendor_rating > 0 ? vendor.vendor_rating.toFixed(1) : 'New'}
            </Text>
          </View>
          {vendor.distance != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="navigate-outline" size={10} color="#6B5E50" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{formatDistance(vendor.distance)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ProductResultCard({ product, onEnquire }: { product: any; onEnquire: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85} onPress={onEnquire}
      style={{
        backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
        borderRadius: 18, overflow: 'hidden', marginBottom: 10, flexDirection: 'row',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
      }}
    >
      <View style={{ width: 88, height: 100, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Ionicons name="cube-outline" size={26} color="#3D3026" />
        }
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>{product.name}</Text>
          {product.description && (
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }} numberOfLines={1}>{product.description}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#E8521A' }}>{formatPrice(product.price ?? 0)}</Text>
          {product.vendor_shop_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="storefront-outline" size={11} color="#9A8570" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }} numberOfLines={1}>{product.vendor_shop_name}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          {product.vendor_rating != null && product.vendor_rating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={10} color="#F5A623" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#FDF6EC' }}>
                {product.vendor_rating.toFixed(1)}
              </Text>
            </View>
          )}
          {product.distance != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="navigate-outline" size={10} color="#6B5E50" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{formatDistance(product.distance)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Suggestion row icon helper ───────────────────────────────────────────────
function suggestionIcon(source: SuggestionSource): { name: IoniconsName; color: string; bg: string } {
  switch (source) {
    case 'history':  return { name: 'time-outline',       color: '#E8521A', bg: 'rgba(232,82,26,0.15)' };
    case 'trending': return { name: 'trending-up-outline', color: '#F5A623', bg: 'rgba(245,166,35,0.15)' };
    case 'product':  return { name: 'cube-outline',        color: '#9A8570', bg: '#2A1F14' };
    case 'vendor':   return { name: 'storefront-outline',  color: '#9A8570', bg: '#2A1F14' };
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const { lat, lng } = useLocation();
  const { user } = useAuthStore();
  const { showAlert: vendrAlert, alertElement } = useVendrAlert();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<RNTextInput>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownTapped = useRef(false);

  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [nearbyVendors, setNearbyVendors] = useState<any[]>([]);
  const [farVendors, setFarVendors] = useState<any[]>([]);
  const [nearbyReels, setNearbyReels] = useState<any[]>([]);
  const [farReels, setFarReels] = useState<any[]>([]);
  const [showFarVendors, setShowFarVendors] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // mixedFeed is computed once per search result and stored stably
  const [mixedFeed, setMixedFeed] = useState<any[]>([]);
  const [myVendorIds, setMyVendorIds] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Location picker state
  const [locationMode, setLocationMode] = useState<'gps' | 'destination'>('gps');
  const [searchLat, setSearchLat] = useState<number | null>(null);
  const [searchLng, setSearchLng] = useState<number | null>(null);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<any[]>([]);

  const searchBarRef = useRef<View>(null);
  const [searchBarBottom, setSearchBarBottom] = useState(0);

  // React Query hooks
  const { data: suggestionsData } = useSearchSuggestions(query);
  const { data: searchHistoryData, refetch: refetchHistory } = useSearchHistory();
  const { data: myVendorData } = useMyVendor();
  const saveHistoryMutation = useSaveSearchHistory();
  const clearHistoryMutation = useClearSearchHistory();

  // Sync React Query data to local state
  useEffect(() => {
    if (searchHistoryData) setRecentSearches(searchHistoryData);
  }, [searchHistoryData]);

  useEffect(() => {
    if (myVendorData) setMyVendorIds([myVendorData.id]);
    else setMyVendorIds([]);
  }, [myVendorData]);

  useFocusEffect(useCallback(() => { refetchHistory(); }, [refetchHistory]));

  // Load recent destinations on mount
  useEffect(() => {
    loadRecentDestinations();
  }, []);

  const loadRecentDestinations = async () => {
    try {
      const stored = await AsyncStorage.getItem('recent_destinations');
      if (stored) {
        setRecentDestinations(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent destinations:', error);
    }
  };

  const saveRecentDestination = async (destination: any) => {
    try {
      const updated = [destination, ...recentDestinations.filter(d => d.place_id !== destination.place_id)].slice(0, 5);
      setRecentDestinations(updated);
      await AsyncStorage.setItem('recent_destinations', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent destination:', error);
    }
  };

  // Sync search location with GPS when in GPS mode
  useEffect(() => {
    if (locationMode === 'gps' && lat != null && lng != null) {
      setSearchLat(lat);
      setSearchLng(lng);
      setDestinationName(null);
    }
  }, [locationMode, lat, lng]);

  // Location autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (locationQuery.length >= 2) {
        const results = await getPlaceSuggestions(locationQuery);
        setLocationSuggestions(results);
      } else {
        setLocationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  // ── Suggestions: sync with React Query data ───────────────────────────────────
  useEffect(() => {
    if (query.length < 1) {
      // TikTok style: no history in dropdown when input is empty
      setSuggestions([]);
      return;
    }

    // Use React Query data for suggestions (no history)
    if (suggestionsData) {
      const rows: SuggestionRow[] = [];

      // 1. Trending queries from other users
      (suggestionsData.trending ?? []).forEach((t: string, i: number) => {
        rows.push({ key: `trend-${i}`, source: 'trending', label: t });
      });

      // 2. Matching products
      (suggestionsData.products ?? []).forEach((p: any) => {
        rows.push({
          key: `prod-${p.id}`,
          source: 'product',
          label: p.name,
          subtitle: formatPrice(p.price),
          image_url: p.image_url ?? undefined,
        });
      });

      // 3. Matching vendors
      (suggestionsData.vendors ?? []).forEach((v: any) => {
        rows.push({
          key: `vend-${v.id}`,
          source: 'vendor',
          label: v.business_name,
          subtitle: v.category ?? undefined,
          image_url: v.logo_url ?? undefined,
          rating: v.rating ?? 0,
        });
      });

      setSuggestions(rows.slice(0, 8));
    }
  }, [query, dropdownVisible, suggestionsData]);

  // ── Run search ─────────────────────────────────────────────────────────────
  const runSearch = async (q: string, categoryOverride?: Category | 'All') => {
    if (!q.trim()) return;
    setDropdownVisible(false);
    setQuery('');
    setSuggestions([]);
    inputRef.current?.blur();
    setCommittedQuery(q);
    setLoading(true);
    setHasSearched(true);

    const effectiveCategory = categoryOverride ?? activeCategory;
    if (categoryOverride !== undefined && categoryOverride !== activeCategory) {
      setActiveCategory(categoryOverride);
    }

    if (user?.id) {
      await saveHistoryMutation.mutateAsync(q.trim()).catch(() => {});
      setRecentSearches(prev => [q, ...prev.filter(s => s !== q)].slice(0, 10));
    }

    try {
      const queryParams = {
        q,
        limit: 50,
        ...(effectiveCategory !== 'All' && { category: effectiveCategory }),
        ...(verifiedOnly && { verified_only: true }),
        ...(minRating > 0 && { min_rating: minRating }),
        ...(searchLat != null && { lat: searchLat }),
        ...(searchLng != null && { lng: searchLng }),
        // Add distance filtering for GPS-based searches (10km radius for local discovery)
        ...(searchLat != null && searchLng != null && { max_distance: 10 }),
      };

      const { data } = await searchApi.search(queryParams);

      const allVendors: any[] = data?.vendors ?? [];
      const allReels: any[] = data?.reels ?? [];
      const allProducts: any[] = data?.products ?? [];

      const nearby = allVendors.filter((v: any) => v.distance != null && v.distance <= 5);
      const far = allVendors.filter((v: any) => v.distance == null || v.distance > 5);
      const nearbyR = allReels.filter((r: any) => r.distance != null && r.distance <= 5);
      const farR = allReels.filter((r: any) => r.distance == null || r.distance > 5);

      setNearbyVendors(nearby);
      setFarVendors(far);
      setVendors(allVendors);
      setProducts(allProducts);
      setReels(allReels);
      setNearbyReels(nearbyR);
      setFarReels(farR);
      setShowFarVendors(false);

      // Build the feed once — stable, no re-shuffle on re-render
      setMixedFeed(buildMixedFeed(nearby, far, allProducts, nearbyR, farR, false));
    } catch (error: any) {
      vendrAlert({ title: 'Search Failed', message: error.message || 'Something went wrong', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // Re-build feed when user expands far results (but NOT on every render)
  useEffect(() => {
    if (!hasSearched) return;
    setMixedFeed(buildMixedFeed(nearbyVendors, farVendors, products, nearbyReels, farReels, showFarVendors));
  }, [showFarVendors]);

  const clearSearch = () => {
    setQuery('');
    setCommittedQuery('');
    setHasSearched(false);
    setVendors([]); setProducts([]); setReels([]);
    setNearbyVendors([]); setFarVendors([]);
    setNearbyReels([]); setFarReels([]);
    setShowFarVendors(false);
    setMixedFeed([]);
    setSuggestions([]);
    setDropdownVisible(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onRefresh = useCallback(async () => {
    if (committedQuery) {
      setRefreshing(true);
      await runSearch(committedQuery);
      setRefreshing(false);
    }
  }, [committedQuery]);

  const clearHistory = async () => {
    try {
      await clearHistoryMutation.mutateAsync();
      setRecentSearches([]);
    } catch {}
  };

  const removeHistoryItem = async (item: string) => {
    try {
      await clearHistoryMutation.mutateAsync(item);
      setRecentSearches(prev => prev.filter(s => s !== item));
    } catch {
      vendrAlert({ title: 'Error', message: 'Failed to delete item', type: 'danger' });
    }
  };

  // Location picker handlers
  const handleSelectDestination = (destination: any) => {
    const destLat = parseFloat(destination.lat);
    const destLng = parseFloat(destination.lon);
    setSearchLat(destLat);
    setSearchLng(destLng);
    setDestinationName(destination.display_name);
    setLocationMode('destination');
    setShowLocationPicker(false);
    setLocationQuery('');
    setLocationSuggestions([]);
    saveRecentDestination(destination);
  };

  const handleUseGPS = () => {
    setLocationMode('gps');
    setShowLocationPicker(false);
  };

  const handleClearDestination = () => {
    setLocationMode('gps');
    setDestinationName(null);
    setSearchLat(lat);
    setSearchLng(lng);
  };

  const vendorsWithLocation = vendors.filter(v => v.vendor_lat != null && v.vendor_lng != null);
  const showMapFab = hasSearched && vendorsWithLocation.length > 0 && !loading;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      {alertElement}
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, zIndex: 100, backgroundColor: '#0F0A06' }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#FDF6EC', marginBottom: 16 }}>Search</Text>

        {/* Location picker */}
        <View style={{ zIndex: showLocationPicker ? 10 : 1, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => setShowLocationPicker(!showLocationPicker)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#1A1208', borderWidth: 1,
              borderColor: showLocationPicker ? '#E8521A' : '#3D3026',
              borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
            }}
          >
            <Ionicons name="location-outline" size={16} color={locationMode === 'destination' ? '#E8521A' : '#9A8570'} />
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#FDF6EC', flex: 1 }}>
              {locationMode === 'destination' && destinationName
                ? destinationName.split(',')[0]
                : 'Current location (GPS)'}
            </Text>
            <Ionicons name={showLocationPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#6B5E50" />
          </TouchableOpacity>

          {/* Location picker dropdown */}
          {showLocationPicker && (
            <View style={{
              marginTop: 6,
              backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#E8521A44',
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              {/* Current location option */}
              <TouchableOpacity
                onPress={handleUseGPS}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#2A1F14',
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(85,153,232,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="navigate" size={16} color="#5599E8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>Current location (GPS)</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }}>Use your device location</Text>
                </View>
                {locationMode === 'gps' && <Ionicons name="checkmark-circle" size={18} color="#2D8653" />}
              </TouchableOpacity>

              {/* Type destination option */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#6B5E50', letterSpacing: 1 }}>SEARCH NEAR DESTINATION</Text>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#0F0A06', borderWidth: 1,
                  borderColor: locationQuery.length > 0 ? '#E8521A' : '#2A1F14',
                  borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8,
                }}>
                  <Ionicons name="search-outline" size={14} color={locationQuery.length > 0 ? '#E8521A' : '#9A8570'} />
                  <RNTextInput
                    style={{ flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#FDF6EC', backgroundColor: 'transparent' }}
                    placeholder="Type a place (e.g., Ikeja)"
                    placeholderTextColor="#6B5E50"
                    selectionColor="#E8521A"
                    cursorColor="#E8521A"
                    value={locationQuery}
                    onChangeText={setLocationQuery}
                    underlineColorAndroid="transparent"
                  />
                  {locationQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setLocationQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={14} color="#6B5E50" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Location suggestions */}
                {locationSuggestions.length > 0 && (
                  <View style={{ marginTop: 4, gap: 2 }}>
                    {locationSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={suggestion.place_id}
                        onPress={() => handleSelectDestination(suggestion)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          paddingHorizontal: 10, paddingVertical: 8,
                          backgroundColor: index === 0 ? 'rgba(232,82,26,0.08)' : 'transparent',
                          borderRadius: 8,
                        }}
                      >
                        <Ionicons name="location-outline" size={14} color="#9A8570" />
                        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#FDF6EC', flex: 1 }} numberOfLines={1}>
                          {suggestion.display_name.split(',')[0]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Recent destinations */}
                {locationQuery.length === 0 && recentDestinations.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: '#6B5E50', marginBottom: 6 }}>RECENT DESTINATIONS</Text>
                    {recentDestinations.map((dest) => (
                      <TouchableOpacity
                        key={dest.place_id}
                        onPress={() => handleSelectDestination(dest)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          paddingHorizontal: 10, paddingVertical: 8,
                          borderRadius: 8,
                        }}
                      >
                        <Ionicons name="time-outline" size={14} color="#9A8570" />
                        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#FDF6EC', flex: 1 }} numberOfLines={1}>
                          {dest.display_name.split(',')[0]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Search input */}
        <View
          ref={searchBarRef}
          onLayout={(e) => {
            searchBarRef.current?.measureInWindow((x, y, w, h) => {
              setSearchBarBottom(y + h + 4);
            });
          }}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#1A1208', borderWidth: 1,
            borderColor: dropdownVisible ? '#E8521A' : '#3D3026',
            borderRadius: 18, paddingHorizontal: 14, height: 52, gap: 10, marginBottom: 10,
          }}>
          <Ionicons name="search-outline" size={18} color={dropdownVisible ? '#E8521A' : '#9A8570'} />
          <RNTextInput
            ref={inputRef}
            style={{ flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, color: '#FDF6EC', backgroundColor: 'transparent' }}
            placeholder={committedQuery.length > 0 ? `"${committedQuery}"` : 'Search vendors, products...'}
            placeholderTextColor="#6B5E50"
            selectionColor="#E8521A"
            cursorColor="#E8521A"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setDropdownVisible(true);
            }}
            onFocus={() => setDropdownVisible(true)}
            onBlur={() => {
              setTimeout(() => {
                if (!dropdownTapped.current) setDropdownVisible(false);
                dropdownTapped.current = false;
              }, 250);
            }}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
            underlineColorAndroid="transparent"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#6B5E50" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: showFilters ? '#E8521A' : '#2A1F14' }}
          >
            <Ionicons name="options-outline" size={16} color={showFilters ? 'white' : '#9A8570'} />
          </TouchableOpacity>
        </View>

        {/* Filter panel */}
        {showFilters && (
          <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 18, padding: 16, marginBottom: 10, gap: 14 }}>
            <TouchableOpacity onPress={() => setVerifiedOnly(!verifiedOnly)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#2D8653" />
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>Verified vendors only</Text>
              </View>
              <View style={{ width: 42, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: verifiedOnly ? '#E8521A' : '#2A1F14', borderWidth: 1, borderColor: verifiedOnly ? '#E8521A' : '#3D3026', paddingHorizontal: 3 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'white', alignSelf: verifiedOnly ? 'flex-end' : 'flex-start' }} />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#6B5E50', letterSpacing: 1, marginBottom: 8 }}>MINIMUM RATING</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 3, 4, 4.5].map(r => (
                  <TouchableOpacity key={r} onPress={() => setMinRating(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: minRating === r ? '#E8521A' : '#2A1F14', borderWidth: 1, borderColor: minRating === r ? '#E8521A' : '#3D3026' }}>
                    {r === 0
                      ? <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: minRating === r ? 'white' : '#9A8570' }}>Any</Text>
                      : <><Ionicons name="star" size={11} color={minRating === r ? 'white' : '#F5A623'} /><Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: minRating === r ? 'white' : '#9A8570' }}>{r}+</Text></>
                    }
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Category chips — only after search */}
        {hasSearched && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.label;
              return (
                <TouchableOpacity
                  key={cat.label} onPress={() => runSearch(committedQuery, cat.label)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: isActive ? 'rgba(232,82,26,0.15)' : '#1A1208', borderWidth: 1, borderColor: isActive ? 'rgba(232,82,26,0.5)' : '#2A1F14' }}
                >
                  <Ionicons name={cat.icon} size={13} color={isActive ? '#E8521A' : '#9A8570'} />
                  <Text style={{ fontFamily: isActive ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular', fontSize: 12, color: isActive ? '#E8521A' : '#9A8570' }}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Suggestions dropdown ── */}
        {dropdownVisible && (
          <View style={{
            position: 'absolute',
            top: searchBarBottom + 8,
            left: 20, right: 20,
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#E8521A44',
            borderRadius: 16, zIndex: 9999,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
            overflow: 'hidden',
          }}>
            {/* "Search for X" row — always first when there's typed text */}
            {query.length > 0 && (
              <TouchableOpacity
                onPressIn={() => { dropdownTapped.current = true; }}
                onPress={() => runSearch(query)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: suggestions.length > 0 ? 1 : 0, borderBottomColor: '#2A1F14',
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,82,26,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="search-outline" size={16} color="#E8521A" />
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC', flex: 1 }} numberOfLines={1}>{query}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#E8521A22', borderRadius: 8 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#E8521A' }}>Search</Text>
                </View>
              </TouchableOpacity>
            )}

            {suggestions.map((s, i) => {
              const isLast = i === suggestions.length - 1;
              const iconCfg = suggestionIcon(s.source);
              return (
                <TouchableOpacity
                  key={s.key}
                  onPressIn={() => { dropdownTapped.current = true; }}
                  onPress={() => runSearch(s.label)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 11,
                    borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#2A1F14',
                  }}
                >
                  {/* Left icon / image */}
                  {s.image_url
                    ? <Image source={{ uri: s.image_url }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A1F14' }} resizeMode="cover" />
                    : <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconCfg.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={iconCfg.name} size={16} color={iconCfg.color} />
                      </View>
                  }

                  {/* Text */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>{s.label}</Text>
                    {s.subtitle ? (
                      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: s.source === 'product' ? '#F5A623' : '#9A8570' }} numberOfLines={1}>
                        {s.subtitle}{s.source === 'vendor' && s.rating != null && s.rating > 0 ? `  ·  ★ ${s.rating.toFixed(1)}` : ''}
                      </Text>
                    ) : null}
                  </View>

                  {/* Source badge or trending arrow */}
                  {s.source === 'trending' ? (
                    <Ionicons name="trending-up-outline" size={14} color="#F5A623" />
                  ) : (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#2A1F14', borderRadius: 8 }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#6B5E50' }}>{s.source}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      
      {/* ── Main content ── */}
      <ScrollView
        style={{ flex: 1, zIndex: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8521A" colors={["#E8521A"]} />
        }
      >
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
            <ActivityIndicator size="large" color="#E8521A" />
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570' }}>Searching...</Text>
          </View>
        )}

        {/* Idle state */}
        {!hasSearched && !loading && (
          <View style={{ gap: 24, paddingTop: 8 }}>
            <View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>Browse by Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.filter(c => c.label !== 'All').map(cat => (
                  <TouchableOpacity key={cat.label} onPress={() => runSearch(cat.label, cat.label as Category)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 }}
                  >
                    <Ionicons name={cat.icon} size={16} color="#E8521A" />
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#FDF6EC' }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {recentSearches.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearHistory}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#9A8570' }}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 2 }}>
                  {recentSearches.map(s => (
                    <TouchableOpacity key={s} onPress={() => runSearch(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                      <Ionicons name="time-outline" size={16} color="#6B5E50" />
                      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', flex: 1 }}>{s}</Text>
                      <TouchableOpacity onPress={() => removeHistoryItem(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-outline" size={16} color="#3D3026" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* No results */}
        {hasSearched && !loading && vendors.length === 0 && products.length === 0 && reels.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="search-outline" size={28} color="#3D3026" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>No results found</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', paddingHorizontal: 32 }}>
              No vendors or products match "{committedQuery}". Try a different search.
            </Text>
          </View>
        )}

        {/* Results feed */}
        {hasSearched && !loading && (vendors.length > 0 || products.length > 0 || reels.length > 0) && (
          <View>
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>
                Results for <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: '#E8521A' }}>"{committedQuery}"</Text>
                {'  '}
                <Text style={{ color: '#3D3026' }}>
                  {vendors.length + products.length + reels.length} found
                </Text>
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP }}>
              {mixedFeed.map((item) => {
                if (item.itemType === 'vendor') {
                  return (
                    <View key={`vendor-${item.id}`} style={{ width: CARD_W }}>
                      <VendorGridCard vendor={item} />
                    </View>
                  );
                } else if (item.itemType === 'product') {
                  return (
                    <View key={`product-${item.id}`} style={{ width: '100%' }}>
                      <ProductResultCard
                        product={item}
                        onEnquire={() => {
                          if (myVendorIds.includes(item.vendor_id)) { router.push('/my-stores'); return; }
                          router.push({
                            pathname: '/chat/[conversationId]',
                            params: { vendorId: item.vendor_id, productId: item.id, productName: item.name ?? '', productPrice: formatPrice(item.price ?? 0) },
                          });
                        }}
                      />
                    </View>
                  );
                } else if (item.itemType === 'reel') {
                  return (
                    <View key={`reel-${item.id}`} style={{ width: CARD_W }}>
                      <ReelCard reel={item} cardWidth={CARD_W} />
                    </View>
                  );
                }
                return null;
              })}
            </View>

            {/* Expand far results */}
            {(farVendors.length > 0 || farReels.length > 0) && !showFarVendors && (
              <View style={{ marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => setShowFarVendors(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 }}
                >
                  <Ionicons name="location-outline" size={14} color="#6B5E50" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#6B5E50' }}>
                    Show {farVendors.length + farReels.length} more beyond 5km
                  </Text>
                  <Ionicons name="chevron-down-outline" size={12} color="#6B5E50" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Map FAB */}
      {showMapFab && (
        <TouchableOpacity
          onPress={() => {
            const ids = vendorsWithLocation.map(v => v.id);
            router.push({ pathname: '/map-search', params: { vendorIds: JSON.stringify(ids), searchQuery: committedQuery } });
          }}
          activeOpacity={0.9}
          style={{ position: 'absolute', bottom: 28, right: 20, height: 48, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#E8521A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#E8521A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 }}
        >
          <Ionicons name="map" size={18} color="white" />
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'white' }}>
            View {vendorsWithLocation.length} on map
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Feed builder — called once per search, no random re-sort on render ────────
/**
 * Interleaves nearby vendors, products, and reels into a single ranked list.
 * Order: 2 vendors → 1 product → 1 reel → repeat.
 * Far results are appended below only when showFar = true.
 * Items are sorted by their backend score (desc) before interleaving, NOT randomised.
 */
function buildMixedFeed(
  nearbyVendors: any[],
  farVendors: any[],
  products: any[],
  nearbyReels: any[],
  farReels: any[],
  showFar: boolean,
): any[] {
  // Sort each bucket by score descending (backend already sorted, but be safe)
  const sV = [...nearbyVendors].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const sP = [...products].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const sR = [...nearbyReels].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const feed: any[] = [];
  let vi = 0, pi = 0, ri = 0;

  while (vi < sV.length || pi < sP.length || ri < sR.length) {
    // 2 vendors
    for (let i = 0; i < 2 && vi < sV.length; i++, vi++) {
      feed.push({ ...sV[vi], itemType: 'vendor' });
    }
    // 1 product
    if (pi < sP.length) { feed.push({ ...sP[pi], itemType: 'product' }); pi++; }
    // 1 reel
    if (ri < sR.length) { feed.push({ ...sR[ri], itemType: 'reel' }); ri++; }
  }

  if (showFar) {
    const sfV = [...farVendors].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const sfR = [...farReels].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    let fvi = 0, fri = 0;
    while (fvi < sfV.length || fri < sfR.length) {
      for (let i = 0; i < 2 && fvi < sfV.length; i++, fvi++) {
        feed.push({ ...sfV[fvi], itemType: 'vendor', isFar: true });
      }
      if (fri < sfR.length) { feed.push({ ...sfR[fri], itemType: 'reel', isFar: true }); fri++; }
    }
  }

  return feed;
}