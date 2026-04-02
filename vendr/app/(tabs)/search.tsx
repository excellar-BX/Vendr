import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Dimensions,
  TextInput as RNTextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { searchApi, vendorApi } from '../../lib/api';
import { useLocation } from '../../hooks/useLocation';
import { calcDistance, formatPrice, formatDistance } from '../../lib/utils';
import { Vendor, Product, Category } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useVendrAlert } from '../../components/ui/VendrAlert';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type FilterTab = 'all' | 'vendors' | 'products';

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

interface Suggestion {
  suggestion: string;
  source: string;
  subtitle?: string;
  image_url?: string;
  rating?: number;
}

function VendorGridCard({ vendor }: { vendor: Vendor }) {
  const cfg = categoryConfig[vendor.category] ?? { color: '#E8521A', icon: 'storefront-outline' as IoniconsName };
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
        {vendor.banner_url
          ? <Image source={{ uri: vendor.banner_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${cfg.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={cfg.icon} size={22} color={cfg.color} />
            </View>
        }
        {vendor.is_verified && (
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
        {vendor.logo_url && (
          <View style={{ position: 'absolute', bottom: -16, left: 10 }}>
            <Image source={{ uri: vendor.logo_url }} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: '#1A1208' }} resizeMode="cover" />
          </View>
        )}
      </View>
      <View style={{ padding: 10, paddingTop: vendor.logo_url ? 22 : 10, gap: 4 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#FDF6EC' }} numberOfLines={1}>{vendor.shop_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={cfg.icon} size={10} color={cfg.color} />
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }} numberOfLines={1}>{vendor.category}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={10} color="#F5A623" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#FDF6EC' }}>
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
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

function ProductResultCard({ product, onEnquire }: { product: Product & { vendor_name?: string }; onEnquire: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85} onPress={onEnquire}
      style={{
        backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
        borderRadius: 18, overflow: 'hidden', marginBottom: 10, flexDirection: 'row',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
      }}
    >
      <View style={{ width: 88, height: 88, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
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
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#E8521A' }}>{formatPrice(product.price)}</Text>
          {product.vendor_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="storefront-outline" size={11} color="#9A8570" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }} numberOfLines={1}>{product.vendor_name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 20 }}>
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>{title}</Text>
      <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>{count} found</Text>
    </View>
  );
}

export default function SearchScreen() {
  const { lat, lng } = useLocation();
  const { user } = useAuthStore();
  const { showAlert: vendrAlert } = useVendrAlert();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<RNTextInput>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownTapped = useRef(false);

  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<(Product & { vendor_name?: string })[]>([]);
  const [myVendorIds, setMyVendorIds] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Dropdown sits just below the search input
  const DROPDOWN_TOP = insets.top + 56 + 40 + 52 + 10;

  useEffect(() => {
    if (!user?.id) return;
    loadMyVendors();
    loadHistory();
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadHistory(); }, [user?.id]));

  const loadHistory = async () => {
    if (!user?.id) return;
    try {
      const { data } = await searchApi.getHistory();
      if (data) setRecentSearches(data);
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const loadMyVendors = async () => {
    if (!user?.id) return;
    try {
      const { data } = await vendorApi.getMyVendor();
      if (data) {
        setMyVendorIds(data ? [data.id] : []);
      }
    } catch (error) {
      // Not an error if user is not a vendor - just keep empty array
      setMyVendorIds([]);
    }
  };

  // Suggestions — API call
  useEffect(() => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (query.length < 1) { setSuggestions([]); return; }

    suggestTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchApi.suggestions({ q: query, limit: 5 });
        const results: Suggestion[] = [];

        (data?.products ?? []).forEach((p: any) => {
          results.push({
            suggestion: p.name,
            source: 'product',
            subtitle: formatPrice(p.price),
            image_url: p.image_url ?? undefined,
            rating: 0,
          });
        });

        (data?.vendors ?? []).forEach((v: any) => {
          results.push({
            suggestion: v.business_name,
            source: 'vendor',
            subtitle: v.category,
            image_url: v.logo_url ?? undefined,
            rating: v.rating ?? 0,
          });
        });

        setSuggestions(results);
      } catch (error) {
        console.error('Suggestion fetch error:', error);
        setSuggestions([]);
      }
    }, 200);
  }, [query]);

  // THE search — only called by explicit user tap
  // Strip filler words and extract the real search term
  const extractSearchTerm = (raw: string): string => {
    let q = raw.toLowerCase();
    const fillers = [
      'near me', 'around me', 'close to me', 'nearby', 'in lagos', 'in abuja',
      'in nigeria', 'around here', 'close by', 'around', 'near',
      'vendor', 'vendors', 'seller', 'sellers', 'shop', 'store', 'stores',
      'cheap', 'cheapest', 'affordable', 'best', 'good', 'top', 'quality',
      'where can i buy', 'where to buy', 'i need', 'i want', 'looking for',
      'find me', 'get me', 'show me',
    ];
    fillers.forEach(f => { q = q.replace(new RegExp(`\\b${f}\\b`, 'gi'), ''); });
    return q.replace(/\s+/g, ' ').trim() || raw.trim();
  };

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setDropdownVisible(false);
    setQuery('');
    setSuggestions([]);
    inputRef.current?.blur();
    setCommittedQuery(q);
    setLoading(true);
    setHasSearched(true);

    // Persist original query to history
    if (user?.id) {
      await searchApi.saveHistory(q.trim());
      setRecentSearches(prev => [q, ...prev.filter(s => s !== q)].slice(0, 10));
    }

    // Perform search via API
    try {
      const { data } = await searchApi.search({
        q,
        category: activeCategory !== 'All' ? activeCategory : undefined,
        verified_only: verifiedOnly,
        min_rating: minRating > 0 ? minRating : undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        limit: 50,
      });

      // Transform vendor data to match expected format
      const vList: Vendor[] = (data?.vendors ?? []).map((v: any) => ({
        id: v.id,
        user_id: v.user_id,
        shop_name: v.shop_name,
        description: v.description,
        category: v.category,
        address: v.address,
        lat: v.lat,
        lng: v.lng,
        phone: v.phone,
        whatsapp: v.whatsapp,
        instagram: v.instagram,
        twitter: v.twitter,
        open_days: v.open_days,
        open_time: v.open_time,
        close_time: v.close_time,
        logo_url: v.logo_url,
        banner_url: v.banner_url,
        is_verified: v.is_verified,
        is_active: v.is_active,
        rating: v.rating,
        review_count: v.review_count,
        created_at: v.created_at,
        updated_at: v.updated_at,
        user: v.user,
        distance: v.distance,
      }));

      // Sort by distance if lat/lng available
      if (lat && lng) {
        vList.forEach(v => {
          v.distance = (v.lat != null && v.lng != null) ? calcDistance(lat, lng, v.lat!, v.lng!) : undefined;
        });
        vList.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
      }

      setVendors(vList);

      // Transform product data
      setProducts((data?.products ?? []).map((p: any) => ({
        id: p.id,
        vendor_id: p.vendor_id,
        name: p.name,
        description: p.description,
        price: p.price,
        image_url: p.image_url,
        is_available: p.is_available,
        created_at: p.created_at,
        updated_at: p.updated_at,
        vendor_name: p.vendor_name,
      })));
    } catch (error: any) {
      console.error('Search error:', error);
      vendrAlert({ title: 'Search Failed', message: error.message || 'Something went wrong', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setCommittedQuery('');
    setHasSearched(false);
    setVendors([]);
    setProducts([]);
    setSuggestions([]);
    setDropdownVisible(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const clearHistory = async () => {
    try {
      await searchApi.clearHistory();
      setRecentSearches([]);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  };

  const removeHistoryItem = async (item: string) => {
    // The backend doesn't have an endpoint to delete individual items yet
    // For now, just clear all and re-add the filtered list
    setRecentSearches(prev => prev.filter(s => s !== item));
    // TODO: Add backend endpoint to delete single search history item if needed
  };

  const filteredVendors  = activeFilter === 'products' ? [] : vendors;
  const filteredProducts = activeFilter === 'vendors'  ? [] : products;
  const totalResults = filteredVendors.length + filteredProducts.length;
  const showMapFab = hasSearched && filteredVendors.length > 0 && !loading;

  const vendorRows: Vendor[][] = [];
  for (let i = 0; i < filteredVendors.length; i += 2) vendorRows.push(filteredVendors.slice(i, i + 2));

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#FDF6EC', marginBottom: 16 }}>Search</Text>

        {/* Search input */}
        <View style={{
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
              setDropdownVisible(text.length >= 1);
            }}
            onFocus={() => {
              if (query.length >= 1) setDropdownVisible(true);
            }}
            onBlur={() => {
              // If user tapped a dropdown row, dropdownTapped ref prevents hiding
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

        {/* Filter tabs — only after a search */}
        {hasSearched && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { key: 'all', label: 'All', icon: 'apps-outline' },
              { key: 'vendors', label: 'Vendors', icon: 'storefront-outline' },
              { key: 'products', label: 'Products', icon: 'cube-outline' },
            ] as { key: FilterTab; label: string; icon: IoniconsName }[]).map(tab => (
              <TouchableOpacity
                key={tab.key} onPress={() => setActiveFilter(tab.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: activeFilter === tab.key ? '#E8521A' : '#1A1208', borderWidth: 1, borderColor: activeFilter === tab.key ? '#E8521A' : '#2A1F14' }}
              >
                <Ionicons name={tab.icon} size={13} color={activeFilter === tab.key ? 'white' : '#9A8570'} />
                <Text style={{ fontFamily: activeFilter === tab.key ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular', fontSize: 12, color: activeFilter === tab.key ? 'white' : '#9A8570' }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Dropdown — absolutely positioned, floats over everything ── */}
      {dropdownVisible && (
        <View
          style={{
            position: 'absolute', top: DROPDOWN_TOP, left: 20, right: 20,
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#E8521A44',
            borderRadius: 16, zIndex: 9999,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
            overflow: 'hidden',
          }}
        >
          {/* Always-present row: the raw query */}
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

          {/* RPC suggestion rows */}
          {suggestions.map((s, i) => {
            const isHistory = s.source === 'history';
            const isProduct = s.source === 'product';
            const isLast    = i === suggestions.length - 1;
            return (
              <TouchableOpacity
                key={`${s.suggestion}-${i}`}
                onPressIn={() => { dropdownTapped.current = true; }}
                onPress={() => runSearch(s.suggestion)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 11,
                  borderBottomWidth: isLast ? 0 : 1, borderBottomColor: '#2A1F14',
                }}
              >
                {s.image_url
                  ? <Image source={{ uri: s.image_url }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A1F14' }} resizeMode="cover" />
                  : <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isHistory ? 'rgba(232,82,26,0.12)' : '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={isHistory ? 'time-outline' : isProduct ? 'cube-outline' : 'storefront-outline'} size={16} color={isHistory ? '#E8521A' : '#9A8570'} />
                    </View>
                }
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }} numberOfLines={1}>{s.suggestion}</Text>
                  {s.subtitle ? (
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: isProduct ? '#F5A623' : '#9A8570' }} numberOfLines={1}>
                      {s.subtitle}{s.source === 'vendor' && s.rating != null && s.rating > 0 ? `  ·  ${s.rating.toFixed(1)}` : ''}
                    </Text>
                  ) : null}
                </View>
                {!isHistory && (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#2A1F14', borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 10, color: '#6B5E50' }}>{s.source}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Category chips — only after a search */}
      {hasSearched && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 10 }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.label;
            return (
              <TouchableOpacity
                key={cat.label} onPress={() => setActiveCategory(cat.label)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: isActive ? 'rgba(232,82,26,0.15)' : '#1A1208', borderWidth: 1, borderColor: isActive ? 'rgba(232,82,26,0.5)' : '#2A1F14' }}
              >
                <Ionicons name={cat.icon} size={13} color={isActive ? '#E8521A' : '#9A8570'} />
                <Text style={{ fontFamily: isActive ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular', fontSize: 12, color: isActive ? '#E8521A' : '#9A8570' }}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
            <ActivityIndicator size="large" color="#E8521A" />
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570' }}>Searching...</Text>
          </View>
        )}

        {!hasSearched && !loading && (
          <View style={{ gap: 24, paddingTop: 8 }}>
            <View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>Browse by Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.filter(c => c.label !== 'All').map(cat => (
                  <TouchableOpacity key={cat.label} onPress={() => runSearch(cat.label)}
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

        {hasSearched && !loading && totalResults === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="search-outline" size={28} color="#3D3026" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>No results found</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', paddingHorizontal: 32 }}>
              No vendors or products match "{committedQuery}". Try a different search.
            </Text>
          </View>
        )}

        {hasSearched && !loading && totalResults > 0 && (
          <View>
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>
                Results for <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: '#E8521A' }}>"{committedQuery}"</Text>
              </Text>
            </View>
            {filteredVendors.length > 0 && (
              <View>
                <SectionHeader title="Vendors" count={filteredVendors.length} />
                {vendorRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: 'row', gap: CARD_GAP }}>
                    {row.map(v => <VendorGridCard key={v.id} vendor={v} />)}
                    {row.length === 1 && <View style={{ width: CARD_W }} />}
                  </View>
                ))}
              </View>
            )}
            {filteredProducts.length > 0 && (
              <View>
                <SectionHeader title="Products" count={filteredProducts.length} />
                {filteredProducts.map(p => (
                  <ProductResultCard
                    key={p.id} product={p}
                    onEnquire={() => {
                      if (myVendorIds.includes(p.vendor_id)) { router.push('/my-stores'); return; }
                      router.push({ pathname: '/chat/[conversationId]', params: { vendorId: p.vendor_id, productId: p.id, productName: p.name, productPrice: formatPrice(p.price) } });
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {showMapFab && (
        <TouchableOpacity onPress={() => {
          const ids = filteredVendors.filter(v => v.lat && v.lng).map(v => v.id);
          if (ids.length === 0) return;
          router.push({ pathname: '/map-search', params: { vendorIds: JSON.stringify(ids), searchQuery: committedQuery } });
        }} activeOpacity={0.9}
          style={{ position: 'absolute', bottom: 28, right: 20, height: 48, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#E8521A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#E8521A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 }}
        >
          <Ionicons name="map" size={18} color="white" />
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'white' }}>
            View {filteredVendors.filter(v => v.lat && v.lng).length} on map
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}