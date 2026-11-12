import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, AppState, LayoutChangeEvent,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { ReelItem, FeedReel, normalizeReel, useReelOwnerMenu, onReelUpdated, reelFeedSignal } from '../../components/reel/ReelViewer';
import { useAuthStore } from '../../stores/authStore';
import { reelApi } from '../../lib/api';
import { useReelInteractions } from '../../components/reel/useReelInteractions';
import { useLocation } from '../../hooks/useLocation';

const PAGE = 10;

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isVendor } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();

  // The feed fills exactly the space above the tab bar — measured, not guessed
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || Math.abs(size.height - height) > 1) setSize({ width, height });
  };

  const [reels, setReels] = useState<FeedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const offsetRef = useRef(0);
  const listRef = useRef<FlatList<FeedReel>>(null);

  // "For You" is ranked (fresh, engaging, near you, stores you follow); "Following" is just your stores
  const [mode, setMode] = useState<'for_you' | 'following'>('for_you');
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Location boosts nearby stores — wait briefly for it on first load, never block on it
  const { lat, lng, loading: locLoading } = useLocation();
  const locRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  locRef.current = { lat, lng };
  const [locWaitOver, setLocWaitOver] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLocWaitOver(true), 2500); return () => clearTimeout(t); }, []);
  const locationReady = !locLoading || locWaitOver;

  const { onComments, onFollow, onReport, sheets } = useReelInteractions(reels, setReels);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const fetchPage = useCallback(async (offset: number) => {
    const { data } = await reelApi.getReels({
      limit: PAGE,
      offset,
      mode: modeRef.current,
      lat: locRef.current.lat,
      lng: locRef.current.lng,
    });
    const page = ((data ?? []) as any[]).map(normalizeReel);
    setHasMore(page.length === PAGE);
    offsetRef.current = offset + page.length;
    return page;
  }, []);

  const loadFirst = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(0);
      setReels(page);
      setActiveIndex(0);
      if (isRefresh) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  // Load once per tab (For You / Following) — coming back to Reels keeps your place
  useEffect(() => {
    if (user?.id && locationReady) loadFirst();
  }, [user?.id, mode, locationReady]);

  const switchMode = (m: 'for_you' | 'following') => {
    if (m === mode) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true }); // tap again = back to top
      return;
    }
    setReels([]);
    setMode(m);
  };

  // …except right after you posted, so your new post is at the top
  useFocusEffect(useCallback(() => {
    if (reelFeedSignal.dirty) {
      reelFeedSignal.dirty = false;
      loadFirst(true);
    }
  }, [loadFirst]));

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(offsetRef.current);
      setReels((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id))];
      });
    } catch {
      // keep what we have; the next scroll retries
    } finally {
      setLoadingMore(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems.find((v: any) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Optimistic like/save with rollback
  const patch = (id: string, fn: (r: FeedReel) => FeedReel) => setReels((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));

  const handleLike = useCallback(async (id: string, liked: boolean) => {
    const apply = (on: boolean) => (r: FeedReel) => ({ ...r, is_liked: on, like_count: Math.max(0, r.like_count + (on ? 1 : -1)) });
    patch(id, apply(liked));
    try { await reelApi.toggleLike(id); } catch { patch(id, apply(!liked)); }
  }, []);

  const handleSave = useCallback(async (id: string, saved: boolean) => {
    const apply = (on: boolean) => (r: FeedReel) => ({ ...r, is_saved: on, save_count: Math.max(0, r.save_count + (on ? 1 : -1)) });
    patch(id, apply(saved));
    try { await reelApi.toggleSave(id); } catch { patch(id, apply(!saved)); }
  }, []);

  // ⋯ on your own post: edit (first 15 minutes) or delete
  const onDeleted = useCallback((id: string) => setReels((prev) => prev.filter((r) => r.id !== id)), []);
  const handleOwnerMenu = useReelOwnerMenu({ showAlert, onDeleted });

  // An edit saved elsewhere updates this list in place
  useEffect(() => onReelUpdated((u) => setReels((prev) => prev.map((r) => (r.id === u.id ? { ...r, ...u } : r)))), []);

  const playingAllowed = focused && appActive;

  const Tab = ({ value, label }: { value: 'for_you' | 'following'; label: string }) => {
    const active = mode === value;
    return (
      <TouchableOpacity onPress={() => switchMode(value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ alignItems: 'center', paddingHorizontal: 6 }}>
        <Text style={{ fontSize: 16.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 }}>
          {label}
        </Text>
        <View style={{ marginTop: 4, width: 22, height: 2.5, borderRadius: 2, backgroundColor: active ? '#FFFFFF' : 'transparent' }} />
      </TouchableOpacity>
    );
  };

  const header = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <Tab value="following" label="Following" />
        <Tab value="for_you" label="For You" />
      </View>
      {isVendor && (
        <TouchableOpacity
          onPress={() => router.push('/reel-insights')}
          accessibilityLabel="Post insights"
          style={{ position: 'absolute', left: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="stats-chart" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      {isVendor && (
        <TouchableOpacity
          onPress={() => router.push('/reel-upload')}
          accessibilityLabel="Create a post"
          style={{ position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const centered = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 }}>
      <StatusBar style="light" />
      {children}
      {header}
      {sheets}
      {alertElement}
    </View>
  );

  if (loading && reels.length === 0) {
    return centered(<ActivityIndicator size="large" color="#E8521A" />);
  }

  if (error && reels.length === 0) {
    return centered(
      <>
        <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.6)" />
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Couldn't load reels</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Check your connection and try again.</Text>
        <TouchableOpacity onPress={() => loadFirst()} style={{ marginTop: 8, backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Retry</Text>
        </TouchableOpacity>
      </>
    );
  }

  if (reels.length === 0 && mode === 'following') {
    return centered(
      <>
        <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: 'rgba(255,59,92,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <Ionicons name="heart-circle-outline" size={38} color="#FF3B5C" />
        </View>
        <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', textAlign: 'center' }}>Nothing from stores you follow</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 }}>
          Tap the + on a store's avatar in For You to follow it. Their new posts land here.
        </Text>
        <TouchableOpacity onPress={() => switchMode('for_you')} style={{ marginTop: 8, backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Browse For You</Text>
        </TouchableOpacity>
      </>
    );
  }

  if (reels.length === 0) {
    return centered(
      <>
        <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: 'rgba(232,82,26,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <Ionicons name="albums-outline" size={36} color="#E8521A" />
        </View>
        <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', textAlign: 'center' }}>No posts yet</Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 }}>
          {isVendor ? 'Be the first — share a video or a few photos of what you sell.' : 'Vendors haven’t posted yet. Check back soon.'}
        </Text>
        {isVendor && (
          <TouchableOpacity onPress={() => router.push('/reel-upload')} style={{ marginTop: 8, backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Create a post</Text>
          </TouchableOpacity>
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={onLayout}>
      <StatusBar style="light" />
      {size && (
        <FlatList
          ref={listRef}
          data={reels}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item}
              isActive={index === activeIndex}
              isScreenFocused={playingAllowed}
              mountMedia={Math.abs(index - activeIndex) <= 1}
              width={size.width}
              height={size.height}
              topInset={insets.top + 44}
              bottomInset={0}
              currentUserId={user?.id ?? ''}
              onLike={handleLike}
              onSave={handleSave}
              onOwnerMenu={handleOwnerMenu}
              onComments={onComments}
              onFollow={onFollow}
              onReport={onReport}
            />
          )}
          extraData={[activeIndex, playingAllowed]}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: size.height, offset: size.height * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={3}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(true)} tintColor="#FFFFFF" colors={['#E8521A']} progressViewOffset={insets.top + 40} />}
        />
      )}
      {header}
      {sheets}
      {alertElement}
    </View>
  );
}
