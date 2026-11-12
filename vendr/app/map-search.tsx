import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator, Image, ScrollView, FlatList, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ui/StyledText';
import { vendorApi } from '../lib/api';
import { useLocation } from '../hooks/useLocation';
import { calcDistance, formatDistance } from '../lib/utils';
import { Vendor, Category } from '../types';
import { T, useTheme } from '../constants/theme';
import { Fonts } from '../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 64, 340);
const CARD_GAP = 12;
const CAROUSEL_H = 132;
const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos

const CATEGORIES: { label: Category | 'All'; icon: IoniconsName; color: string }[] = [
  { label: 'All',           icon: 'grid-outline',           color: '#E8521A' },
  { label: 'Food & Drinks', icon: 'fast-food-outline',      color: '#E8521A' },
  { label: 'Fashion',       icon: 'shirt-outline',          color: '#D97706' },
  { label: 'Accessories',   icon: 'diamond-outline',        color: '#78716C' },
  { label: 'Beauty & Hair', icon: 'cut-outline',            color: '#DB2777' },
  { label: 'Electronics',   icon: 'phone-portrait-outline', color: '#2563EB' },
  { label: 'Groceries',     icon: 'basket-outline',         color: '#2D8653' },
];
const catMeta = (c?: string) => CATEGORIES.find((x) => x.label === c) ?? { label: c ?? 'Store', icon: 'storefront-outline' as IoniconsName, color: '#E8521A' };

const isVerified = (v: Vendor) => !!(v.user?.is_vendor_verified ?? v.is_verified);

// ─────────────────────────────────────────────────────────────────────────────
// Map page (Leaflet in a WebView). Built ONCE per theme; pins are pushed in via
// injected JS, so changing category / selection never reloads the map.
// ─────────────────────────────────────────────────────────────────────────────
function buildMapHTML(opts: { dark: boolean; bottomOffset: number; topOffset: number }) {
  // CARTO basemaps need a *basemaps* key (free, from carto.com/basemaps/apikey —
  // NOT a CARTO platform API token). Without one, CARTO returns an
  // "API KEY REQUIRED" image, so we fall back to OpenStreetMap (no key needed)
  // and darken it with a CSS filter in dark mode.
  const cartoKey = process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY?.trim();
  const useCarto = !!cartoKey;
  const tiles = useCarto
    ? `https://basemaps.cartocdn.com/${opts.dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey!)}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileFilter = useCarto
    ? ''
    : opts.dark
      ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.85) saturate(0.6); }'
      : '.leaflet-tile-pane { filter: saturate(0.85); }';
  const attribution = useCarto ? '&copy; OpenStreetMap contributors &copy; CARTO' : '&copy; OpenStreetMap contributors';
  const bg = opts.dark ? '#0C0A09' : '#F7F7F5';
  const ring = opts.dark ? '#1C1917' : '#FFFFFF';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body, #map { width: 100%; height: 100%; background: ${bg}; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-bottom { bottom: ${opts.bottomOffset}px; }
  ${tileFilter}
  .leaflet-control-attribution { font-size: 9px; background: ${opts.dark ? 'rgba(12,10,9,0.7)' : 'rgba(255,255,255,0.75)'} !important; color: ${opts.dark ? '#A8A29E' : '#57534E'}; }
  .leaflet-control-attribution a { color: inherit; }

  .pin { position: relative; width: 40px; height: 48px; transition: transform .18s ease; transform-origin: 50% 100%; }
  .pin .head {
    width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
    background: ${ring}; border: 3px solid #E8521A;
    box-shadow: 0 3px 10px rgba(0,0,0,.28);
    display: flex; align-items: center; justify-content: center;
    color: #E8521A; font-weight: 800; font-size: 15px;
  }
  .pin .head img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pin .tip {
    position: absolute; left: 50%; bottom: 1px; width: 10px; height: 10px; margin-left: -5px;
    background: #E8521A; transform: rotate(45deg); border-radius: 2px;
  }
  .pin.verified .head { border-color: #2D8653; }
  .pin.verified .tip { background: #2D8653; }
  .pin.selected { transform: scale(1.25); z-index: 1000; }
  .pin .badge {
    position: absolute; top: -3px; right: -3px; width: 16px; height: 16px; border-radius: 50%;
    background: #2D8653; border: 2px solid ${ring}; color: #fff; font-size: 9px; line-height: 12px; text-align: center; font-weight: 900;
  }
  .label {
    position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%);
    white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis;
    background: ${opts.dark ? '#FAFAF9' : '#1C1917'}; color: ${opts.dark ? '#1C1917' : '#FFFFFF'};
    font-size: 12px; font-weight: 700; padding: 5px 9px; border-radius: 999px;
    box-shadow: 0 3px 10px rgba(0,0,0,.25); display: none;
  }
  .pin.selected .label { display: block; }

  .cluster {
    border-radius: 50%; background: #E8521A; color: #fff; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 4px solid rgba(232,82,26,.3); background-clip: padding-box;
    box-shadow: 0 3px 10px rgba(0,0,0,.25);
  }
  .me { width: 18px; height: 18px; border-radius: 50%; background: #2563EB; border: 3px solid #fff; box-shadow: 0 0 0 8px rgba(37,99,235,.18); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  (function () {
  if (!window.L || !L.markerClusterGroup) { post({ type: 'error' }); return; }

  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 13);
  map.attributionControl.setPrefix(false);
  L.tileLayer('${tiles}', {
    maxZoom: 19,
    attribution: '${attribution}'
  }).addTo(map);

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 48,
    iconCreateFunction: function (c) {
      var n = c.getChildCount(); var s = n < 10 ? 38 : n < 50 ? 46 : 54;
      return L.divIcon({ html: '<div class="cluster" style="width:' + s + 'px;height:' + s + 'px;font-size:' + (n < 100 ? 14 : 12) + 'px">' + n + '</div>', className: '', iconSize: [s, s] });
    }
  });
  map.addLayer(cluster);

  var markers = {}; var selected = null; var meMarker = null;

  function pinEl(p, isSel) {
    var root = document.createElement('div');
    root.className = 'pin' + (p.verified ? ' verified' : '') + (isSel ? ' selected' : '');
    var label = document.createElement('div'); label.className = 'label'; label.textContent = p.name; root.appendChild(label);
    var head = document.createElement('div'); head.className = 'head';
    if (p.logo) {
      var img = document.createElement('img'); img.src = p.logo;
      img.setAttribute('onerror', "this.parentNode.textContent='" + (p.initial || '?').replace(/'/g, '') + "'");
      head.appendChild(img);
    } else { head.textContent = p.initial || '?'; }
    root.appendChild(head);
    var tip = document.createElement('div'); tip.className = 'tip'; root.appendChild(tip);
    if (p.verified) { var b = document.createElement('div'); b.className = 'badge'; b.textContent = '✓'; root.appendChild(b); }
    return root;
  }
  function iconFor(p, isSel) { return L.divIcon({ html: pinEl(p, isSel), className: '', iconSize: [40, 48], iconAnchor: [20, 48] }); }

  window.setPins = function (json, fit) {
    var pins = JSON.parse(json);
    cluster.clearLayers(); markers = {};
    pins.forEach(function (p) {
      var m = L.marker([p.lat, p.lng], { icon: iconFor(p, p.id === selected), riseOnHover: true });
      m._pin = p;
      m.on('click', function (e) { L.DomEvent.stopPropagation(e); window.selectPin(p.id, false); post({ type: 'select', id: p.id }); });
      markers[p.id] = m; cluster.addLayer(m);
    });
    if (fit) window.fitAll();
  };

  window.fitAll = function () {
    var pts = Object.keys(markers).map(function (k) { return markers[k].getLatLng(); });
    if (meMarker) pts.push(meMarker.getLatLng());
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, ${opts.topOffset}], paddingBottomRight: [40, ${opts.bottomOffset + 20}], maxZoom: 16 });
  };

  window.selectPin = function (id, pan) {
    if (selected && markers[selected]) markers[selected].setIcon(iconFor(markers[selected]._pin, false));
    selected = id;
    var m = id && markers[id];
    if (!m) return;
    m.setIcon(iconFor(m._pin, true));
    m.setZIndexOffset(1000);
    if (pan) {
      cluster.zoomToShowLayer(m, function () {
        var pt = map.project(m.getLatLng(), map.getZoom()).add([0, ${Math.round(opts.bottomOffset / 2) - 40}]);
        map.panTo(map.unproject(pt, map.getZoom()), { animate: true });
      });
    }
  };

  window.setMe = function (lat, lng) {
    if (meMarker) { meMarker.setLatLng([lat, lng]); return; }
    meMarker = L.marker([lat, lng], { icon: L.divIcon({ html: '<div class="me"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: -100 }).addTo(map);
  };

  window.recenter = function (lat, lng) { map.flyTo([lat, lng], 15, { duration: 0.6 }); };

  map.on('click', function () { window.selectPin(null, false); post({ type: 'deselect' }); });
  post({ type: 'ready' });
  })();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function MapSearchScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { lat, lng, loading: locLoading } = useLocation();
  const params = useLocalSearchParams<{ vendorIds?: string; searchQuery?: string }>();

  const passedIds = useMemo<string[]>(() => {
    try { return params.vendorIds ? JSON.parse(params.vendorIds) : []; } catch { return []; }
  }, [params.vendorIds]);
  const isSearchMode = passedIds.length > 0;
  const searchQuery = params.searchQuery ?? '';
  const hasUserLoc = lat != null && lng != null;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [fetching, setFetching] = useState(true);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const webRef = useRef<WebView>(null);
  const listRef = useRef<FlatList<Vendor>>(null);

  const headerH = insets.top + 118;
  const bottomOffset = CAROUSEL_H + insets.bottom + 28;
  const html = useMemo(
    () => buildMapHTML({ dark: T.isDark, bottomOffset, topOffset: headerH + 10 }),
    [T.scheme], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const run = useCallback((js: string) => webRef.current?.injectJavaScript(`try{${js}}catch(e){};true;`), []);

  // Fetch once location has resolved (so distances are real when available)
  const fetchVendors = useCallback(async () => {
    setFetching(true);
    setFailed(false);
    try {
      const { data } = await vendorApi.getVendors({
        is_active: true,
        has_location: true,
        ids: isSearchMode ? passedIds : undefined,
        ...(hasUserLoc && { lat: lat!, lng: lng! }),
      });
      setVendors((data ?? []).filter((v: Vendor) => v.lat != null && v.lng != null));
    } catch {
      setFailed(true);
      setVendors([]);
    } finally {
      setFetching(false);
    }
  }, [isSearchMode, passedIds, hasUserLoc, lat, lng]);

  useEffect(() => { if (!locLoading) fetchVendors(); }, [locLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vendors for the current category, nearest first when we know where the user is
  const display = useMemo(() => {
    const list = category === 'All' ? vendors : vendors.filter((v) => v.category === category);
    const withDist = list.map((v) => ({
      ...v,
      distance: hasUserLoc ? calcDistance(lat!, lng!, v.lat!, v.lng!) : undefined,
    }));
    return hasUserLoc ? withDist.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)) : withDist;
  }, [vendors, category, hasUserLoc, lat, lng]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { All: vendors.length };
    vendors.forEach((v) => { m[v.category] = (m[v.category] ?? 0) + 1; });
    return m;
  }, [vendors]);

  // Push pins whenever the visible set changes (no map reload)
  useEffect(() => {
    if (!mapReady) return;
    const pins = display.map((v) => ({
      id: v.id, lat: v.lat, lng: v.lng, name: v.shop_name,
      initial: (v.shop_name?.trim()?.[0] ?? '?').toUpperCase(),
      logo: v.logo_url ?? null, verified: isVerified(v),
    }));
    run(`window.setPins(${JSON.stringify(JSON.stringify(pins))}, true);`);
    setSelectedId(null);
  }, [mapReady, display, run]);

  useEffect(() => {
    if (mapReady && hasUserLoc) run(`window.setMe(${lat}, ${lng});`);
  }, [mapReady, hasUserLoc, lat, lng, run]);

  // Map → carousel
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') { setMapReady(true); setMapFailed(false); }
      else if (msg.type === 'error') setMapFailed(true);
      else if (msg.type === 'select') {
        setSelectedId(msg.id);
        const index = display.findIndex((v) => v.id === msg.id);
        if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } else if (msg.type === 'deselect') setSelectedId(null);
    } catch {}
  };

  // Carousel → map
  const onCarouselSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
    const v = display[Math.max(0, Math.min(index, display.length - 1))];
    if (v && v.id !== selectedId) {
      setSelectedId(v.id);
      run(`window.selectPin(${JSON.stringify(v.id)}, true);`);
    }
  };

  const focusVendor = (v: Vendor) => {
    if (v.id === selectedId) {
      router.push({ pathname: '/vendor/[id]', params: { id: v.id } });
      return;
    }
    setSelectedId(v.id);
    run(`window.selectPin(${JSON.stringify(v.id)}, true);`);
  };

  const showOverlay = !mapReady || (fetching && vendors.length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      <WebView
        key={T.scheme}
        ref={webRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: T.canvas }}
        onMessage={onMessage}
        onLoadStart={() => setMapReady(false)}
        onError={() => setMapFailed(true)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />

      {/* ── Floating header ── */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <RoundButton icon="arrow-back" onPress={() => router.back()} label="Go back" />
          <View style={{
            flex: 1, height: 46, borderRadius: 999, backgroundColor: T.surface, paddingHorizontal: 16,
            justifyContent: 'center', borderWidth: 1, borderColor: T.line,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
          }}>
            <Text numberOfLines={1} style={{ fontFamily: Fonts.bold, fontSize: 14, color: T.ink }}>
              {isSearchMode ? `“${searchQuery}”` : 'Vendors near you'}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 11, color: T.ink3 }}>
              {fetching ? 'Loading…' : `${display.length} on map${hasUserLoc ? '' : ' · location off'}`}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {CATEGORIES.filter((c) => c.label === 'All' || (categoryCounts[c.label] ?? 0) > 0 || !isSearchMode).map((c) => {
            const active = category === c.label;
            const count = categoryCounts[c.label] ?? 0;
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
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
                }}
              >
                <Ionicons name={c.icon} size={14} color={active ? T.canvas : c.label === 'All' ? T.ink2 : c.color} />
                <Text style={{ fontFamily: active ? Fonts.semibold : Fonts.medium, fontSize: 12, color: active ? T.canvas : T.ink }}>{c.label}</Text>
                {count > 0 && c.label !== 'All' && (
                  <Text style={{ fontFamily: Fonts.semibold, fontSize: 11, color: active ? T.canvas : T.ink3 }}>{count}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Right-side controls ── */}
      {!showOverlay && (
        <View style={{ position: 'absolute', right: 16, bottom: bottomOffset + 8, gap: 10 }}>
          {display.length > 1 && <RoundButton icon="scan-outline" onPress={() => run('window.fitAll();')} label="Show all vendors" />}
          {hasUserLoc && <RoundButton icon="navigate" iconColor={T.infoInk} onPress={() => run(`window.recenter(${lat}, ${lng});`)} label="Centre on my location" />}
        </View>
      )}

      {/* ── Bottom carousel ── */}
      {!showOverlay && display.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16 }}>
          <FlatList
            ref={listRef}
            data={display}
            keyExtractor={(v) => v.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (SCREEN_W - CARD_W) / 2, gap: CARD_GAP }}
            onMomentumScrollEnd={onCarouselSettle}
            getItemLayout={(_, i) => ({ length: CARD_W + CARD_GAP, offset: (CARD_W + CARD_GAP) * i, index: i })}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item }) => (
              <MapVendorCard vendor={item} selected={item.id === selectedId} onPress={() => focusVendor(item)} />
            )}
          />
        </View>
      )}

      {/* ── Empty / error ── */}
      {!showOverlay && display.length === 0 && (
        <View style={{
          position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, padding: 18, borderRadius: 20,
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, alignItems: 'center', gap: 6,
          shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8,
        }}>
          <Ionicons name={failed ? 'cloud-offline-outline' : 'storefront-outline'} size={26} color={T.ink3} />
          <Text style={{ fontFamily: Fonts.bold, fontSize: 15, color: T.ink }}>
            {failed ? 'Couldn’t load vendors' : category === 'All' ? 'No vendors with a location yet' : `No ${category} vendors here`}
          </Text>
          {failed ? (
            <TouchableOpacity onPress={fetchVendors} style={{ marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: T.primary }}>
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: '#FFFFFF' }}>Try again</Text>
            </TouchableOpacity>
          ) : category !== 'All' ? (
            <TouchableOpacity onPress={() => setCategory('All')} style={{ marginTop: 6 }}>
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 13, color: T.primaryInk }}>Show all categories</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ── Loading ── */}
      {showOverlay && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {mapFailed ? (
            <>
              <Ionicons name="cloud-offline-outline" size={32} color={T.ink3} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: T.ink }}>Map couldn’t load</Text>
              <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: T.ink2 }}>Check your connection and try again.</Text>
              <TouchableOpacity
                onPress={() => { setMapFailed(false); webRef.current?.reload(); }}
                style={{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999, backgroundColor: T.primary }}
              >
                <Text style={{ fontFamily: Fonts.semibold, fontSize: 14, color: '#FFFFFF' }}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={T.primary} />
              <Text style={{ fontFamily: Fonts.medium, fontSize: 14, color: T.ink2 }}>
                {locLoading ? 'Finding your location…' : 'Loading map…'}
              </Text>
            </>
          )}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
            <RoundButton icon="arrow-back" onPress={() => router.back()} label="Go back" />
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RoundButton({ icon, onPress, label, iconColor }: { icon: IoniconsName; onPress: () => void; label: string; iconColor?: string }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 46, height: 46, borderRadius: 23, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: T.line,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 6,
      }}
    >
      <Ionicons name={icon} size={20} color={iconColor ?? T.ink} />
    </TouchableOpacity>
  );
}

function MapVendorCard({ vendor, selected, onPress }: { vendor: Vendor; selected: boolean; onPress: () => void }) {
  useTheme();
  const meta = catMeta(vendor.category);
  const verified = isVerified(vendor);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.shop_name}. ${selected ? 'Double tap to open store' : 'Show on map'}`}
      style={{
        width: CARD_W, height: CAROUSEL_H, flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20,
        backgroundColor: T.surface, borderWidth: 2, borderColor: selected ? T.primary : T.line,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 8,
      }}
    >
      <View style={{ width: 92, height: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: `${meta.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
        {vendor.banner_url || vendor.logo_url
          ? <Image source={{ uri: (vendor.banner_url || vendor.logo_url)! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <Ionicons name={meta.icon} size={28} color={meta.color} />}
      </View>

      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ fontFamily: Fonts.bold, fontSize: 15, color: T.ink, flexShrink: 1 }}>{vendor.shop_name}</Text>
            {verified && <Ionicons name="shield-checkmark" size={14} color={T.success} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text numberOfLines={1} style={{ fontFamily: Fonts.regular, fontSize: 12, color: T.ink3 }}>{vendor.category}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={12} color={T.gold} />
              <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: T.ink }}>
                {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
              </Text>
              {vendor.review_count > 0 && <Text style={{ fontFamily: Fonts.regular, fontSize: 11, color: T.ink3 }}>({vendor.review_count})</Text>}
            </View>
            {vendor.distance != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="navigate-outline" size={11} color={T.ink3} />
                <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: T.ink2 }}>{formatDistance(vendor.distance)}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open ${vendor.shop_name}`}
          style={{
            alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
            backgroundColor: selected ? T.primary : T.primarySoft,
          }}
        >
          <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: selected ? '#FFFFFF' : T.primaryInk }}>View store</Text>
          <Ionicons name="arrow-forward" size={13} color={selected ? '#FFFFFF' : T.primaryInk} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
