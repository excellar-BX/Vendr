import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity,
  ActivityIndicator, Share, Image, Pressable, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { formatPrice } from '../../lib/utils';

interface VendorInfo {
  business_name: string;
  logo_url: string | null;
  is_verified: boolean;
  category: string;
}

interface ProductInfo {
  name: string;
  price: number;
  image_url: string | null;
}

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
  vendors: VendorInfo | VendorInfo[] | null;
  products: ProductInfo | ProductInfo[] | null;
  is_liked: boolean;
  is_saved: boolean;
}

function getVendor(r: Reel): VendorInfo | null {
  if (!r.vendors) return null;
  return Array.isArray(r.vendors) ? (r.vendors[0] ?? null) : r.vendors;
}
function getProduct(r: Reel): ProductInfo | null {
  if (!r.products) return null;
  return Array.isArray(r.products) ? (r.products[0] ?? null) : r.products;
}

// ─── Single Reel Card ──────────────────────────────────────────────────────────
function ReelCard({
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
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewCountedRef = useRef(false);
  const mountedRef = useRef(true);
  const isOwnReel = reel.user_id === currentUserId;
  const shouldPlay = isActive && isScreenFocused && !paused;

  const vendor = getVendor(reel);
  const product = getProduct(reel);

  // Sync from parent when reel object updates
  useEffect(() => { setLiked(reel.is_liked); }, [reel.is_liked]);
  useEffect(() => { setSaved(reel.is_saved); }, [reel.is_saved]);
  useEffect(() => { setLikeCount(reel.like_count); }, [reel.like_count]);

  // Always-on player — no null swapping, no jank
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

  // Play / pause
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
      console.log('[ReelFeed] play error:', e?.message);
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
      supabase.rpc('increment_reel_views', { p_reel_id: reel.id }).then(({ error }) => {
        if (error) {
          supabase.from('reels')
            .update({ view_count: reel.view_count + 1 })
            .eq('id', reel.id);
        }
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

      {/* 1. Video — always mounted */}
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

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute', top: 56, left: 16, zIndex: 10,
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center', justifyContent: 'center',
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="white" />
      </TouchableOpacity>

      {/* Bottom scrim */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 220, backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 4,
        }}
      />

      {/* Right action bar */}
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
            {vendor?.logo_url
              ? <Image source={{ uri: vendor.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
          onPress={() => Share.share({ message: `Check out ${vendor?.business_name} on Vendr!` })}
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

      {/* Bottom info */}
      <View style={{ position: 'absolute', bottom: 40, left: 14, right: 76, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: reel.vendor_id } })}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>
            {vendor?.business_name}
          </Text>
          {vendor?.is_verified && <Ionicons name="checkmark-circle" size={15} color="#2D8653" />}
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
            backgroundColor: 'rgba(232,82,26,0.25)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.4)',
          }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10, color: '#E8521A' }}>
              {vendor?.category}
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

        {product ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(10,6,2,0.88)',
            borderWidth: 1, borderColor: 'rgba(232,82,26,0.45)',
            borderRadius: 16, padding: 10, alignSelf: 'flex-start',
          }}>
            {product.image_url
              ? <Image source={{ uri: product.image_url }} style={{ width: 42, height: 42, borderRadius: 10, marginRight: 10 }} resizeMode="cover" />
              : <View style={{ width: 42, height: 42, borderRadius: 10, marginRight: 10, backgroundColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={20} color="#3D3026" />
                </View>
            }
            <View style={{ maxWidth: isOwnReel ? 180 : 130 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: 'white' }} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#E8521A' }}>
                {formatPrice(product.price)}
              </Text>
            </View>
            {!isOwnReel && (
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/chat/[conversationId]',
                  params: {
                    vendorId: reel.vendor_id,
                    productId: reel.product_id ?? undefined,
                    productName: product?.name ?? undefined,
                    productPrice: product?.price ? formatPrice(product.price) : undefined,
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

      {/* Seek bar */}
      <TouchableOpacity
        onPress={handleSeekTap}
        activeOpacity={1}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 28, justifyContent: 'flex-end', zIndex: 20,
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

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function ReelFeedScreen() {
  const { reelId, vendorId, startIndex } = useLocalSearchParams<{
    reelId: string;
    vendorId: string;
    startIndex: string;
  }>();
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ITEM_HEIGHT = SH - insets.bottom;

  const { session } = useAuthStore();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const listRef = useRef<FlatList>(null);
  const initialScrollDone = useRef(false);

  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  }, []));

  useEffect(() => {
    const load = async () => {
      if (!vendorId || !session?.user?.id) return;
      const { data } = await supabase
        .from('reels')
        .select(`
          id, vendor_id, user_id, video_url, thumbnail_url, caption,
          product_id, view_count, like_count, save_count, created_at,
          vendors(business_name, logo_url, is_verified, category),
          products(name, price, image_url)
        `)
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const reelIds = data.map((r: any) => r.id);
        const [{ data: likedRows }, { data: savedRows }] = await Promise.all([
          supabase.from('reel_likes').select('reel_id').eq('user_id', session.user.id).in('reel_id', reelIds),
          supabase.from('reel_saves').select('reel_id').eq('user_id', session.user.id).in('reel_id', reelIds),
        ]);
        const likedIds = new Set((likedRows ?? []).map((r: any) => r.reel_id));
        const savedIds = new Set((savedRows ?? []).map((r: any) => r.reel_id));

        const shaped = data.map((r: any) => ({
          ...r,
          is_liked: likedIds.has(r.id),
          is_saved: savedIds.has(r.id),
        }));
        setReels(shaped);

        const idx = shaped.findIndex((r: any) => r.id === reelId);
        const start = idx >= 0 ? idx : parseInt(startIndex ?? '0', 10);
        setActiveIndex(start);
      }
      setLoading(false);
    };
    load();
  }, [vendorId, reelId, session?.user?.id]);

  // Scroll to starting reel after data loads
  useEffect(() => {
    if (reels.length > 0 && activeIndex > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: activeIndex, animated: false });
      }, 50);
    }
  }, [reels, activeIndex]);

  const handleViewableChange = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleLike = useCallback(async (reelId: string, liked: boolean) => {
    if (!session?.user?.id) return;
    setReels(prev => prev.map(r => r.id === reelId
      ? { ...r, is_liked: liked, like_count: liked ? r.like_count + 1 : Math.max(r.like_count - 1, 0) }
      : r
    ));
    if (liked) {
      await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: session.user.id });
    } else {
      await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', session.user.id);
    }
  }, [session?.user?.id]);

  const handleSave = useCallback(async (reelId: string, saved: boolean) => {
    if (!session?.user?.id) return;
    setReels(prev => prev.map(r => r.id === reelId
      ? { ...r, is_saved: saved, save_count: saved ? r.save_count + 1 : Math.max(r.save_count - 1, 0) }
      : r
    ));
    if (saved) {
      await supabase.from('reel_saves').insert({ reel_id: reelId, user_id: session.user.id });
    } else {
      await supabase.from('reel_saves').delete().eq('reel_id', reelId).eq('user_id', session.user.id);
    }
  }, [session?.user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" hidden />
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden />
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            isActive={index === activeIndex}
            isScreenFocused={isScreenFocused}
            onLike={handleLike}
            onSave={handleSave}
            currentUserId={session?.user?.id ?? ''}
            itemWidth={SW}
            itemHeight={ITEM_HEIGHT}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        onViewableItemsChanged={handleViewableChange}
        viewabilityConfig={viewabilityConfig}
        onEndReachedThreshold={2}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        onScrollToIndexFailed={info => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 100);
        }}
      />
    </View>
  );
}