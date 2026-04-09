import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity,
  ActivityIndicator, Share, Image, Pressable,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Text } from '../../components/ui/StyledText';
import { useAuthStore } from '../../stores/authStore';
import { formatPrice } from '../../lib/utils';
import { reelApi } from '../../lib/api';

const LIMIT = 10;

interface Reel {
  id: string;
  vendor_id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  product_id: string | null;
  view_count: number;
  like_count: number;
  save_count: number;
  created_at: string;
  business_name: string;
  vendor_logo: string | null;
  is_verified: boolean;
  vendor_category: string;
  product_name: string | null;
  product_price: number | null;
  product_image: string | null;
  is_liked: boolean;
  is_saved: boolean;
  priority_score: number;
}

// ─── Single Reel Item ──────────────────────────────────────────────────────────
function ReelItem({
  reel,
  isActive,
  isScreenFocused,
  onLike,
  onSave,
  currentUserId,
  itemWidth,
  itemHeight,
}: {
  reel: Reel;
  isActive: boolean;
  isScreenFocused: boolean;
  onLike: (id: string, liked: boolean) => void;
  onSave: (id: string, saved: boolean) => void;
  currentUserId: string;
  itemWidth: number;
  itemHeight: number;
}) {
  const [liked, setLiked] = useState(reel.is_liked);
  const [saved, setSaved] = useState(reel.is_saved);
  const [likeCount, setLikeCount] = useState(reel.like_count);

  // Keep local UI in sync when parent updates the reel object (after DB write)
  useEffect(() => { setLiked(reel.is_liked); }, [reel.is_liked]);
  useEffect(() => { setSaved(reel.is_saved); }, [reel.is_saved]);
  useEffect(() => { setLikeCount(reel.like_count); }, [reel.like_count]);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewCountedRef = useRef(false);
  const mountedRef = useRef(true);
  const isOwnReel = reel.user_id === currentUserId;
  const shouldPlay = isActive && isScreenFocused && !paused;

  // Always create player with URI — destroying/recreating on scroll causes jank.
  // We control play/pause via shouldPlay instead of swapping null/uri.
  const player = useVideoPlayer(
    { uri: reel.video_url },
    (p) => {
      p.loop = true;
      p.muted = false;
      p.volume = 1.0;
    }
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  // Play / pause — small delay so native player finishes init after URL swap
  useEffect(() => {
    if (!player) return;

    if (!shouldPlay) {
      try { player.pause(); } catch (_) {}
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
      return;
    }

    if (!mountedRef.current) return;
    try {
      player.muted = muted;
      player.volume = 1.0;
      player.play();
      setVideoReady(true);
    } catch (e: any) {
      console.log('[Reels] play error:', e?.message);
    }

    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      try {
        const dur = player.duration ?? 0;
        const cur = player.currentTime ?? 0;
        if (dur > 0) setProgress(cur / dur);
      } catch (_) {}
    }, 250);

    if (!viewCountedRef.current) {
      viewCountedRef.current = true;
      // Increment view via backend API (fire and forget)
      reelApi.incrementView(reel.id).catch((e: any) => {
        console.warn('[Reels] incrementView failed:', e?.message);
      });
    }

    return () => {
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
    };
  }, [shouldPlay, player]);

  // Mute sync
  useEffect(() => {
    if (!player) return;
    try { player.muted = muted; } catch (_) {}
  }, [muted, player]);

  // Reset when scrolled away
  useEffect(() => {
    if (!isActive) {
      setVideoReady(false);
      setProgress(0);
      setPaused(false);
      viewCountedRef.current = false;
    }
  }, [isActive]);

  const handleSeekTap = useCallback((e: any) => {
    if (!player) return;
    try {
      const ratio = Math.min(Math.max(e.nativeEvent.locationX / itemWidth, 0), 1);
      const dur = player.duration ?? 0;
      if (dur > 0) {
        player.currentTime = ratio * dur;
        setProgress(ratio);
      }
    } catch (_) {}
  }, [player, itemWidth]);

  const handleLike = () => {
    const n = !liked;
    setLiked(n);
    setLikeCount(prev => n ? prev + 1 : Math.max(prev - 1, 0));
    onLike(reel.id, n);
  };

  const handleSave = () => {
    const n = !saved;
    setSaved(n);
    onSave(reel.id, n);
  };

  return (
    <View style={{ width: itemWidth, height: itemHeight, backgroundColor: '#000', overflow: 'hidden' }}>

      {/* 1. Video — always mounted so it's ready when scrolled to */}
      <VideoView
        player={player}
        style={{ position: 'absolute', top: 0, left: 0, width: itemWidth, height: itemHeight }}
        contentFit="contain"
        nativeControls={false}
      />

      {/* 2. Thumbnail until video ready */}
      {reel.thumbnail_url && !videoReady && (
        <Image
          source={{ uri: reel.thumbnail_url }}
          style={{ position: 'absolute', top: 0, left: 0, width: itemWidth, height: itemHeight, zIndex: 1 }}
          resizeMode="cover"
        />
      )}

      {/* 3. Spinner when no thumbnail and not ready */}
      {!reel.thumbnail_url && !videoReady && (
        <View style={{
          position: 'absolute', top: 0, left: 0, width: itemWidth, height: itemHeight,
          backgroundColor: '#0F0A06', zIndex: 1, alignItems: 'center', justifyContent: 'center',
        }}>
          <ActivityIndicator color="#E8521A" size="large" />
        </View>
      )}

      {/* 4. Tap-to-pause overlay */}
      <Pressable
        onPress={() => setPaused(p => !p)}
        style={{ position: 'absolute', top: 0, left: 0, width: itemWidth, height: itemHeight, zIndex: 2 }}
      />

      {/* Pause icon */}
      {paused && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, width: itemWidth, height: itemHeight,
            alignItems: 'center', justifyContent: 'center', zIndex: 3,
          }}
        >
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="pause" size={38} color="white" />
          </View>
        </View>
      )}

      {/* ── Bottom scrim ── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 220, backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 4,
        }}
      />

      {/* ── Right action bar ── */}
      <View style={{
        position: 'absolute', right: 14, bottom: 110,
        alignItems: 'center', gap: 18, zIndex: 10,
      }}>
        {/* Vendor avatar */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: reel.vendor_id } })}
          activeOpacity={0.85}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            borderWidth: 2, borderColor: '#E8521A',
            overflow: 'hidden', backgroundColor: '#1A1208',
          }}>
            {reel.vendor_logo
              ? <Image source={{ uri: reel.vendor_logo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,82,26,0.2)' }}>
                  <Ionicons name="storefront" size={22} color="#E8521A" />
                </View>
            }
          </View>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity onPress={handleLike} activeOpacity={0.75} style={{ alignItems: 'center', gap: 3 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: liked ? 'rgba(232,82,26,0.25)' : 'rgba(0,0,0,0.5)',
            borderWidth: 1, borderColor: liked ? 'rgba(232,82,26,0.5)' : 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#E8521A' : 'white'} />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: 'white' }}>
            {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
          </Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity onPress={handleSave} activeOpacity={0.75} style={{ alignItems: 'center', gap: 3 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: saved ? 'rgba(245,166,35,0.25)' : 'rgba(0,0,0,0.5)',
            borderWidth: 1, borderColor: saved ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? '#F5A623' : 'white'} />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: 'white' }}>
            {reel.save_count > 999 ? `${(reel.save_count / 1000).toFixed(1)}k` : reel.save_count}
          </Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={() => Share.share({ message: `Check out ${reel.business_name} on Vendr!` })}
          activeOpacity={0.75}
          style={{ alignItems: 'center', gap: 3 }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="arrow-redo-outline" size={22} color="white" />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: 'white' }}>Share</Text>
        </TouchableOpacity>

        {/* Mute */}
        <TouchableOpacity onPress={() => setMuted(m => !m)} activeOpacity={0.8}>
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="white" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Bottom info ── */}
      <View style={{ position: 'absolute', bottom: 40, left: 14, right: 76, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: reel.vendor_id } })}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>
            {reel.business_name}
          </Text>
          {reel.is_verified && <Ionicons name="checkmark-circle" size={15} color="#2D8653" />}
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
            backgroundColor: 'rgba(232,82,26,0.25)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.4)',
          }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10, color: '#E8521A' }}>
              {reel.vendor_category}
            </Text>
          </View>
        </TouchableOpacity>

        {reel.caption ? (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13,
              color: 'rgba(255,255,255,0.85)', lineHeight: 19, marginBottom: 10,
            }}
          >
            {reel.caption}
          </Text>
        ) : null}

        {reel.product_name ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(10,6,2,0.88)',
            borderWidth: 1, borderColor: 'rgba(232,82,26,0.45)',
            borderRadius: 16, padding: 10, alignSelf: 'flex-start',
          }}>
            {reel.product_image
              ? <Image source={{ uri: reel.product_image }} style={{ width: 42, height: 42, borderRadius: 10, marginRight: 10 }} resizeMode="cover" />
              : <View style={{ width: 42, height: 42, borderRadius: 10, marginRight: 10, backgroundColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={20} color="#3D3026" />
                </View>
            }
            <View style={{ maxWidth: isOwnReel ? 180 : 130 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'white' }} numberOfLines={1}>
                {reel.product_name}
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#E8521A' }}>
                {formatPrice(reel.product_price ?? 0)}
              </Text>
            </View>
            {!isOwnReel && (
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/chat/[conversationId]',
                  params: {
                    vendorId: reel.vendor_id,
                    productId: reel.product_id ?? undefined,
                    productName: reel.product_name ?? undefined,
                    productPrice: reel.product_price ? formatPrice(reel.product_price) : undefined,
                  },
                })}
                activeOpacity={0.85}
                style={{ marginLeft: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#E8521A', borderRadius: 11 }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: 'white' }}>Enquire</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* ── Seek bar ── */}
      <TouchableOpacity
        onPress={handleSeekTap}
        activeOpacity={1}
        className='bg-orange/40 rounded-full'
        style={{
          position: 'absolute', bottom: 10, left: 5, right: 5,
          height: 28, justifyContent: 'center', zIndex: 20,
        }}
      >
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <View style={{ height: '100%', backgroundColor: '#E8521A', width: `${Math.round(progress * 100)}%` }} />
          <View style={{
            position: 'absolute',
            left: `${Math.round(progress * 100)}%` as any,
            top: -4, marginLeft: -5,
            width: 11, height: 11, borderRadius: 6, backgroundColor: '#E8521A',
          }} />
        </View>
      </TouchableOpacity>

    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const ITEM_HEIGHT = SH - insets.bottom;

  const { user } = useAuthStore();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const offsetRef = useRef(0);

  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  }, []));

  // Map backend enriched reel to UI format (flatten vendor/product)
  const shapeBackendReel = (data: any[]): Reel[] =>
    data.map((r: any) => ({
      ...r,
      business_name: r.vendor?.business_name ?? '',
      vendor_logo: r.vendor?.logo_url ?? null,
      is_verified: r.vendor?.is_verified ?? false,
      vendor_category: r.vendor?.category ?? '',
      product_name: r.product?.name ?? null,
      product_price: r.product?.price ?? null,
      product_image: r.product?.image_url ?? null,
      priority_score: 0,
    }));

  const fetchReels = useCallback(async (offset = 0) => {
    if (!user?.id) {
      console.log('[Reels] no session — skipping fetch');
      setLoading(false);
      return;
    }
    if (offset === 0) setLoading(true); else setLoadingMore(true);

    try {
      const { data } = await reelApi.getReels({
        limit: LIMIT,
        offset,
      });

      if (data && data.length > 0) {
        const shaped = shapeBackendReel(data);
        if (offset === 0) setReels(shaped); else setReels(prev => [...prev, ...shaped]);
        setHasMore(data.length === LIMIT);
        offsetRef.current = offset + data.length;
      } else {
        if (offset === 0) setReels([]);
        setHasMore(false);
      }
    } catch (e: any) {
      console.error('[Reels] fetch error:', e);
      if (offset === 0) setReels([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    offsetRef.current = 0;
    setActiveIndex(0);
    fetchReels(0);
  }, [fetchReels]));

  const handleViewableChange = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleLike = useCallback(async (reelId: string, liked: boolean) => {
    if (!user?.id) return;
    // Optimistic update
    setReels(prev => prev.map(r => r.id === reelId
      ? { ...r, is_liked: liked, like_count: liked ? r.like_count + 1 : Math.max(r.like_count - 1, 0) }
      : r
    ));
    try {
      await reelApi.toggleLike(reelId);
    } catch (e: any) {
      // Revert on error
      setReels(prev => prev.map(r => r.id === reelId
        ? { ...r, is_liked: !liked, like_count: !liked ? r.like_count + 1 : Math.max(r.like_count - 1, 0) }
        : r
      ));
      console.error('[Reels] toggleLike failed:', e);
    }
  }, [user?.id]);

  const handleSave = useCallback(async (reelId: string, saved: boolean) => {
    if (!user?.id) return;
    // Optimistic update
    setReels(prev => prev.map(r => r.id === reelId
      ? { ...r, is_saved: saved, save_count: saved ? r.save_count + 1 : Math.max(r.save_count - 1, 0) }
      : r
    ));
    try {
      await reelApi.toggleSave(reelId);
    } catch (e: any) {
      // Revert on error
      setReels(prev => prev.map(r => r.id === reelId
        ? { ...r, is_saved: !saved, save_count: !saved ? r.save_count + 1 : Math.max(r.save_count - 1, 0) }
        : r
      ));
      console.error('[Reels] toggleSave failed:', e);
    }
  }, [user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <StatusBar style="light" />
        <View style={{
          width: 72, height: 72, borderRadius: 24,
          backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Ionicons name="play-circle-outline" size={36} color="#3D3026" />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', marginBottom: 8, textAlign: 'center' }}>
          No reels yet
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#6B5E50', textAlign: 'center' }}>
          Vendors have not posted any reels yet. Check back soon.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden />
      <FlatList
        data={reels}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            isScreenFocused={isScreenFocused}
            onLike={handleLike}
            onSave={handleSave}
            currentUserId={user?.id ?? ''}
            itemWidth={SW}
            itemHeight={ITEM_HEIGHT}
          />
        )}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        onViewableItemsChanged={handleViewableChange}
        viewabilityConfig={viewabilityConfig}
        onEndReached={() => { if (hasMore && !loadingMore) fetchReels(offsetRef.current); }}
        onEndReachedThreshold={2}
        ListFooterComponent={loadingMore ? (
          <View style={{ width: SW, height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator size="large" color="#E8521A" />
          </View>
        ) : null}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}