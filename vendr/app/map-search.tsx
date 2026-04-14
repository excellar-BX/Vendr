import { useState, useEffect, useRef } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator,
  Animated, Image, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Text } from '../components/ui/StyledText';
import { vendorApi } from '../lib/api';
import { useLocation } from '../hooks/useLocation';
import { calcDistance } from '../lib/utils';
import { Vendor, Category } from '../types';

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

// ── Leaflet HTML ──────────────────────────────────────────────────────────────
function buildMapHTML(lat: number, lng: number, vendors: Vendor[]) {
  const pins = vendors.map(v => ({
    id: v.id,
    lat: v.lat,
    lng: v.lng,
    name: v.shop_name,
    category: v.category,
    rating: v.rating,
    verified: v.is_verified,
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #0F0A06; }
  .custom-pin {
    background: #E8521A;
    border: 2.5px solid #fff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transition: transform 0.15s;
  }
  .custom-pin.verified { background: #F5A623; }
  .custom-pin.selected { transform: rotate(-45deg) scale(1.35); z-index: 1000 !important; }
  .custom-pin.cluster { 
    background: #E74C3C; 
    width: 24px !important; 
    height: 24px !important; 
    border: 3px solid #fff;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transform: rotate(-45deg) scale(1.2);
  }
  .cluster-count {
    transform: rotate(45deg);
    color: white;
    font-size: 10px;
    font-weight: bold;
    font-family: Arial, sans-serif;
  }
  .user-pin {
    background: #5599E8; border: 3px solid #fff; border-radius: 50%;
    box-shadow: 0 0 0 6px rgba(85,153,232,0.25);
  }
  .leaflet-tile { filter: brightness(0.82) saturate(0.7); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // User dot
  L.marker([${lat}, ${lng}], {
    icon: L.divIcon({ className: '', html: '<div class="user-pin" style="width:16px;height:16px;"></div>', iconSize:[16,16], iconAnchor:[8,8] })
  }).addTo(map);

  var pins = ${JSON.stringify(pins)};
  var markers = {};
  var clusterMarkers = {};
  var clusterThreshold = 0.0005; // ~50 meters threshold for clustering

  // Function to check if two pins are close enough to cluster
  function shouldCluster(pin1, pin2) {
    var distance = Math.sqrt(Math.pow(pin1.lat - pin2.lat, 2) + Math.pow(pin1.lng - pin2.lng, 2));
    return distance < clusterThreshold;
  }

  // Function to create clusters based on current zoom level
  function createClusters(zoomLevel) {
    // Clear ALL existing markers (both individual and cluster)
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    Object.values(clusterMarkers).forEach(marker => map.removeLayer(marker));
    markers = {};
    clusterMarkers = {};
    
    // Adjust threshold based on zoom level (higher zoom = less clustering)
    var threshold = zoomLevel >= 16 ? 0.00005 : zoomLevel >= 15 ? 0.0001 : clusterThreshold;
    console.log('Zoom level:', zoomLevel, 'Threshold:', threshold);
    
    // Cluster overlapping pins
    var clusters = [];
    var processed = new Set();

    pins.forEach(function(pin) {
      if (processed.has(pin.id)) return;
      
      var cluster = [pin];
      processed.add(pin.id);
      
      pins.forEach(function(otherPin) {
        if (!processed.has(otherPin.id) && shouldClusterWithThreshold(pin, otherPin, threshold)) {
          cluster.push(otherPin);
          processed.add(otherPin.id);
        }
      });
      
      clusters.push(cluster);
    });

    return clusters;
  }

  // Function to check clustering with dynamic threshold
  function shouldClusterWithThreshold(pin1, pin2, threshold) {
    var distance = Math.sqrt(Math.pow(pin1.lat - pin2.lat, 2) + Math.pow(pin1.lng - pin2.lng, 2));
    return distance < threshold;
  }

  // Function to render markers for clusters
  function renderMarkers(clusters) {
    clusters.forEach(function(cluster) {
      if (cluster.length === 1) {
        // Single pin
        var v = cluster[0];
        var html = '<div class="custom-pin ' + (v.verified ? 'verified' : '') + '" style="width:18px;height:18px;"></div>';
        var icon = L.divIcon({ className: '', html: html, iconSize:[18,18], iconAnchor:[9,18] });
        var m = L.marker([v.lat, v.lng], { icon: icon }).addTo(map);
        markers[v.id] = m;
        m.on('click', function() {
          Object.keys(markers).forEach(function(id) {
            var el = markers[id].getElement();
            if (el) el.querySelector('.custom-pin').classList.remove('selected');
          });
          var el = m.getElement();
          if (el) el.querySelector('.custom-pin').classList.add('selected');
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: v.id }));
        });
      } else {
        // Cluster pin
        var centerLat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
        var centerLng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;
        var clusterIds = cluster.map(p => p.id);
        
        var html = '<div class="custom-pin cluster" style="width:24px;height:24px;"><div class="cluster-count">' + cluster.length + '</div></div>';
        var icon = L.divIcon({ className: '', html: html, iconSize:[24,24], iconAnchor:[12,24] });
        var m = L.marker([centerLat, centerLng], { icon: icon }).addTo(map);
        clusterMarkers[clusterIds.join(',')] = m;
        
        m.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'cluster', 
            ids: clusterIds,
            centerLat: centerLat,
            centerLng: centerLng
          }));
        });
      }
    });
  }

  // Initial render
  var initialClusters = createClusters(map.getZoom());
  renderMarkers(initialClusters);

  // Re-render when zoom changes
  map.on('zoomend', function() {
    var newClusters = createClusters(map.getZoom());
    renderMarkers(newClusters);
  });

  // Auto-fit bounds to all pins if we have some
  if (pins.length > 0) {
    var latlngs = pins.map(function(p) { return [p.lat, p.lng]; });
    latlngs.push([${lat}, ${lng}]);
    try { map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: 15 }); } catch(e) {}
  }

  map.on('click', function() {
    Object.keys(markers).forEach(function(id) {
      var el = markers[id].getElement();
      if (el) el.querySelector('.custom-pin').classList.remove('selected');
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'deselect' }));
  });
</script>
</body>
</html>`;
}

// ── Vendor bottom card ────────────────────────────────────────────────────────
function VendorMapCard({ vendor, userLat, userLng, onClose, onOpen }: {
  vendor: Vendor; userLat: number; userLng: number;
  onClose: () => void; onOpen: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(220)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [vendor.id]);

  const dist = calcDistance(userLat, userLng, vendor.lat, vendor.lng);

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 24, left: 16, right: 16,
      backgroundColor: '#1A1208', borderRadius: 20, borderWidth: 1, borderColor: '#2A1F14',
      padding: 16, elevation: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20,
      transform: [{ translateY: slideAnim }],
    }}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={22} color="#3D3026" />
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{
          width: 60, height: 60, borderRadius: 16, backgroundColor: '#0F0A06',
          borderWidth: 1, borderColor: '#2A1F14', overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {vendor.logo_url
            ? <Image source={{ uri: vendor.logo_url }} style={{ width: 60, height: 60 }} resizeMode="cover" />
            : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#E8521A' }}>{vendor.shop_name[0]}</Text>
          }
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC', flex: 1 }} numberOfLines={1}>
              {vendor.shop_name}
            </Text>
            {vendor.user?.is_vendor_verified && <Ionicons name="checkmark-circle" size={14} color="#F5A623" />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="storefront-outline" size={12} color="#9A8570" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>{vendor.category}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="navigate-outline" size={12} color="#9A8570" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>
                {dist != null ? `${dist.toFixed(1)} km away` : 'Nearby'}
              </Text>
            </View>
          </View>
          {vendor.rating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name={i <= Math.round(vendor.rating) ? 'star' : 'star-outline'} size={11} color="#F5A623" />
              ))}
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', marginLeft: 2 }}>
                ({vendor.review_count ?? 0})
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={{
        marginTop: 14, backgroundColor: '#E8521A', borderRadius: 14, paddingVertical: 13,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
      }}>
        <Ionicons name="storefront" size={15} color="white" />
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: 'white' }}>View Store</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MapSearchScreen() {
  const { lat, lng, loading: locLoading } = useLocation();
  const params = useLocalSearchParams<{ vendorIds?: string; searchQuery?: string }>();

  // If vendorIds passed → search results mode; otherwise → browse all mode
  const isSearchMode = !!params.vendorIds;
  const searchQuery = params.searchQuery ?? '';
  const passedIds: string[] = params.vendorIds ? JSON.parse(params.vendorIds) : [];

  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const webRef = useRef<WebView>(null);

  const userLat = lat ?? 6.5244;
  const userLng = lng ?? 3.3792;

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    try {
      const { data } = await vendorApi.getVendors({
        is_active: true,
        has_location: true,
        ids: isSearchMode && passedIds.length > 0 ? passedIds : undefined,
        lat: userLat,
        lng: userLng,
      });
      setAllVendors(data ?? []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setAllVendors([]);
    }
  };

  // Apply category filter client-side
  const displayVendors = activeCategory === 'All'
    ? allVendors
    : allVendors.filter(v => v.category === activeCategory);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'select') {
        setSelectedVendor(displayVendors.find(x => x.id === msg.id) ?? null);
      } else if (msg.type === 'deselect') {
        setSelectedVendor(null);
      } else if (msg.type === 'cluster') {
        // Handle cluster click - zoom in aggressively to break apart the cluster
        if (webRef.current) {
          webRef.current.injectJavaScript(`
            var currentZoom = map.getZoom();
            var newZoom = Math.max(currentZoom + 3, 5);
            console.log('Cluster clicked - zooming from', currentZoom, 'to', newZoom);
            map.setView([${msg.centerLat}, ${msg.centerLng}], newZoom);
          `);
        }
      }
    } catch {}
  };

  const mapHTML = buildMapHTML(userLat, userLng, displayVendors);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* ── Floating header ── */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
        paddingHorizontal: 16, paddingBottom: 10,
      }}>
        {/* Top bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#1A1208', borderRadius: 18, borderWidth: 1, borderColor: '#2A1F14',
          paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginBottom: 8,
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
        }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }}>
              {isSearchMode ? `Results for "${searchQuery}"` : 'Vendors near you'}
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>
              {displayVendors.length > 0
                ? `${displayVendors.length} vendor${displayVendors.length !== 1 ? 's' : ''} on map`
                : 'No vendors in this category'}
            </Text>
          </View>

          {/* Search mode badge */}
          {isSearchMode ? (
            <View style={{
              backgroundColor: 'rgba(232,82,26,0.15)', borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: 'rgba(232,82,26,0.35)',
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Ionicons name="search" size={10} color="#E8521A" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#E8521A' }}>
                SEARCH
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: 'rgba(232,82,26,0.12)', borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)',
            }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#E8521A' }}>LIVE MAP</Text>
            </View>
          )}
        </View>

        {/* Search context banner */}
        {isSearchMode && (
          <View style={{
            backgroundColor: 'rgba(15,10,6,0.88)', borderRadius: 14, borderWidth: 1,
            borderColor: 'rgba(232,82,26,0.2)', paddingHorizontal: 14, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Ionicons name="information-circle" size={16} color="#E8521A" />
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', flex: 1, lineHeight: 18 }}>
              Showing vendor locations from your search.{' '}
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', color: '#FDF6EC' }}>
                Tap a pin
              </Text>
              {' '}to see details.
            </Text>
          </View>
        )}

        {/* Category filter chips */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          style={{ flexGrow: 0 }}
        >
          {CATEGORIES
            // In search mode, only show categories that exist in results
            .filter(cat => {
              if (cat.label === 'All') return true;
              if (!isSearchMode) return true;
              return allVendors.some(v => v.category === cat.label);
            })
            .map(cat => {
              const isActive = activeCategory === cat.label;
              const count = cat.label === 'All'
                ? allVendors.length
                : allVendors.filter(v => v.category === cat.label).length;
              return (
                <TouchableOpacity
                  key={cat.label}
                  onPress={() => {
                    setActiveCategory(cat.label);
                    setSelectedVendor(null);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: isActive ? '#E8521A' : 'rgba(26,18,8,0.9)',
                    borderWidth: 1, borderColor: isActive ? '#E8521A' : '#2A1F14',
                  }}
                >
                  <Ionicons name={cat.icon} size={13} color={isActive ? 'white' : '#9A8570'} />
                  <Text style={{
                    fontFamily: isActive ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_400Regular',
                    fontSize: 12, color: isActive ? 'white' : '#9A8570',
                  }}>
                    {cat.label}
                  </Text>
                  {isSearchMode && cat.label !== 'All' && count > 0 && (
                    <View style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(232,82,26,0.2)',
                      borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
                    }}>
                      <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', color: isActive ? 'white' : '#E8521A' }}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>

      {/* Map */}
      <WebView
        ref={webRef}
        source={{ html: mapHTML }}
        style={{ flex: 1 }}
        onMessage={handleMessage}
        onLoadEnd={() => setMapLoading(false)}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />

      {/* Loading overlay */}
      {(mapLoading || locLoading) && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <ActivityIndicator size="large" color="#E8521A" />
          <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#9A8570' }}>
            {locLoading ? 'Getting your location...' : 'Loading map...'}
          </Text>
        </View>
      )}

      {/* Legend — only in browse mode when nothing selected */}
      {!mapLoading && !selectedVendor && !isSearchMode && (
        <View style={{
          position: 'absolute', bottom: 24, left: 16, right: 16,
          backgroundColor: 'rgba(26,18,8,0.88)', borderRadius: 16, borderWidth: 1, borderColor: '#2A1F14',
          padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          {[
            { color: '#E8521A', label: 'Vendor' },
            { color: '#F5A623', label: 'Verified' },
            { color: '#5599E8', label: 'You', dot: true },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{
                width: item.dot ? 10 : 12, height: item.dot ? 10 : 12,
                borderRadius: item.dot ? 5 : 6,
                backgroundColor: item.color,
                transform: item.dot ? [] : [{ rotate: '-45deg' }],
              }} />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* No results in this category */}
      {!mapLoading && displayVendors.length === 0 && !selectedVendor && (
        <View style={{
          position: 'absolute', bottom: 24, left: 16, right: 16,
          backgroundColor: 'rgba(26,18,8,0.92)', borderRadius: 16, borderWidth: 1, borderColor: '#2A1F14',
          padding: 16, alignItems: 'center', gap: 6,
        }}>
          <Ionicons name="storefront-outline" size={24} color="#3D3026" />
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>
            No vendors in this category
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>
            Try selecting a different category above
          </Text>
        </View>
      )}

      {/* Selected vendor card */}
      {selectedVendor && (
        <VendorMapCard
          vendor={selectedVendor}
          userLat={userLat}
          userLng={userLng}
          onClose={() => setSelectedVendor(null)}
          onOpen={() => router.push({ pathname: '/vendor/[id]', params: { id: selectedVendor.id } })}
        />
      )}
    </View>
  );
}