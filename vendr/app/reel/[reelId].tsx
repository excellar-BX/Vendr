import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, AppState, LayoutChangeEvent } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { ReelItem, FeedReel, normalizeReel, useReelOwnerMenu, onReelUpdated } from '../../components/reel/ReelViewer';
import { useAuthStore } from '../../stores/authStore';
import { reelApi } from '../../lib/api';
import { useReelInteractions } from '../../components/reel/useReelInteractions';

/**
 * Full-screen reel viewer opened from a vendor page, profile, saved list or search.
 * Starts on the tapped post and lets you swipe through the rest of that vendor's posts.
 * Works with just a reelId (search results don't know the vendor).
 */
export default function ReelViewerScreen() {
  const { reelId, vendorId, hashtag } = useLocalSearchParams<{ reelId: string; vendorId?: string; hashtag?: string; startIndex?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || Math.abs(size.height - height) > 1) setSize({ width, height });
  };

  const [reels, setReels] = useState<FeedReel[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const listRef = useRef<FlatList<FeedReel>>(null);
  const { onComments, onFollow, onReport, sheets } = useReelInteractions(reels, setReels);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/reels'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let vid = vendorId;
      let tapped: FeedReel | null = null;
      if (reelId) {
        const { data } = await reelApi.getReel(reelId);
        tapped = normalizeReel(data);
        vid = vid || tapped.vendor_id;
      }
      let list: FeedReel[] = [];
      if (hashtag) {
        // Opened from a #tag page: swipe through that tag's posts
        const { data } = await reelApi.getReels({ hashtag, limit: 50 });
        list = ((data ?? []) as any[]).map(normalizeReel);
      } else if (vid) {
        const { data } = await reelApi.getReels({ vendor_id: vid, limit: 50 });
        list = ((data ?? []) as any[]).map(normalizeReel);
      }
      if (tapped && !list.some((r) => r.id === tapped!.id)) list = [tapped, ...list];
      const idx = Math.max(0, list.findIndex((r) => r.id === reelId));
      setReels(list);
      setStartIndex(idx);
      setActiveIndex(idx);
    } catch (e: any) {
      setError(e?.statusCode === 404 ? 'This post is no longer available.' : "Couldn't load this post. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [reelId, vendorId, hashtag]);

  useEffect(() => { load(); }, [load]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems.find((v: any) => v.isViewable);
    if (first?.index != null) setActiveIndex(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

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
  const onDeleted = useCallback((id: string) => setReels((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (next.length === 0) setTimeout(goBack, 0);
      return next;
    }), []);
  const handleOwnerMenu = useReelOwnerMenu({ showAlert, onDeleted });

  // An edit saved elsewhere updates this list in place
  useEffect(() => onReelUpdated((u) => setReels((prev) => prev.map((r) => (r.id === u.id ? { ...r, ...u } : r)))), []);

  const backButton = (
    <TouchableOpacity
      onPress={goBack}
      accessibilityLabel="Back"
      style={{ position: 'absolute', top: insets.top + 6, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );

  if (loading || error || reels.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 }}>
        <StatusBar style="light" />
        {loading ? <ActivityIndicator size="large" color="#E8521A" /> : (
          <>
            <Ionicons name={error?.includes('available') ? 'eye-off-outline' : 'cloud-offline-outline'} size={40} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 16, color: '#FFFFFF', textAlign: 'center' }}>{error ?? 'Nothing to show here.'}</Text>
            {!error?.includes('available') && (
              <TouchableOpacity onPress={load} style={{ marginTop: 6, backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Retry</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {backButton}
      </View>
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
          initialScrollIndex={startIndex}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item}
              isActive={index === activeIndex}
              isScreenFocused={focused && appActive}
              mountMedia={Math.abs(index - activeIndex) <= 1}
              width={size.width}
              height={size.height}
              topInset={insets.top + 48}
              bottomInset={insets.bottom}
              currentUserId={user?.id ?? ''}
              onLike={handleLike}
              onSave={handleSave}
              onOwnerMenu={handleOwnerMenu}
              onComments={onComments}
              onFollow={onFollow}
              onReport={onReport}
            />
          )}
          extraData={[activeIndex, focused, appActive]}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: size.height, offset: size.height * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}
      {backButton}
      {sheets}
      {alertElement}
    </View>
  );
}
