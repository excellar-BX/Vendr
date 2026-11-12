import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, Image, Pressable, TouchableOpacity, Share, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent, Text as RNText,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, runOnJS, Easing,
  ZoomIn, FadeOut, FadeIn,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '../ui/StyledText';
import { formatPrice } from '../../lib/utils';
import { reelApi, reelSocialApi } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeedReel {
  id: string;
  vendor_id: string;
  user_id: string;
  media_type: 'video' | 'photo';
  video_url: string | null;
  image_urls: string[];
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[];
  product_id: string | null;
  view_count: number;
  like_count: number;
  save_count: number;
  created_at: string;
  edited_at: string | null;
  /** Owner can edit until this time (ISO) */
  editable_until: string;
  vendor_name: string;
  vendor_logo: string | null;
  vendor_verified: boolean;
  vendor_category: string | null;
  product_name: string | null;
  product_price: number | null;
  product_image: string | null;
  is_liked: boolean;
  is_saved: boolean;
  comment_count: number;
  share_count: number;
  /** Viewer follows this post's store */
  is_following: boolean;
  vendor_follower_count: number;
  vendor_city: string | null;
  /** km from the viewer (when location is shared) */
  distance_km: number | null;
}

/** Backend enriched reel → flat shape the viewer uses (tolerates old video-only rows). */
export function normalizeReel(r: any): FeedReel {
  const images: string[] = Array.isArray(r.image_urls) ? r.image_urls.filter(Boolean) : [];
  const isPhoto = r.media_type === 'photo' && images.length > 0;
  return {
    id: r.id,
    vendor_id: r.vendor_id,
    user_id: r.user_id,
    media_type: isPhoto ? 'photo' : 'video',
    video_url: r.video_url ?? null,
    image_urls: images,
    thumbnail_url: r.thumbnail_url ?? images[0] ?? null,
    caption: r.caption ?? null,
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    product_id: r.product_id ?? null,
    view_count: r.view_count ?? 0,
    like_count: r.like_count ?? 0,
    save_count: r.save_count ?? 0,
    created_at: r.created_at,
    edited_at: r.edited_at ?? null,
    editable_until: r.editable_until ?? new Date(new Date(r.created_at).getTime() + 15 * 60 * 1000).toISOString(),
    vendor_name: r.vendor?.business_name ?? r.business_name ?? 'Vendor',
    vendor_logo: r.vendor?.logo_url ?? r.vendor_logo ?? null,
    vendor_verified: !!(r.vendor?.is_verified ?? r.is_verified),
    vendor_category: r.vendor?.category ?? r.vendor_category ?? null,
    product_name: r.product?.name ?? r.product_name ?? null,
    product_price: r.product?.price ?? r.product_price ?? null,
    product_image: r.product?.image_url ?? r.product_image ?? null,
    is_liked: !!r.is_liked,
    is_saved: !!r.is_saved,
    comment_count: r.comment_count ?? 0,
    share_count: r.share_count ?? 0,
    is_following: !!r.is_following,
    vendor_follower_count: r.vendor?.follower_count ?? 0,
    vendor_city: r.vendor?.city ?? null,
    distance_km: typeof r.distance_km === 'number' ? r.distance_km : null,
  };
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.max(0, n));
}

/** Set after a successful post so the Reels tab refreshes when you land on it. */
export const reelFeedSignal = { dirty: false };

/** Minutes left to edit (0 when the 15-minute window has closed). */
export function editMinutesLeft(reel: Pick<FeedReel, 'editable_until'>): number {
  const ms = new Date(reel.editable_until).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

// Edited posts are pushed to every open list so they update in place
const updateListeners = new Set<(r: FeedReel) => void>();
export function emitReelUpdated(reel: FeedReel) {
  updateListeners.forEach((l) => { try { l(reel); } catch {} });
}
export function onReelUpdated(listener: (r: FeedReel) => void): () => void {
  updateListeners.add(listener);
  return () => { updateListeners.delete(listener); };
}

// ─── Captions with tappable #hashtags ────────────────────────────────────────

const CAPTION_TAG_RE = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]+)/gu;

export function openHashtag(tag: string) {
  router.push({ pathname: '/hashtag/[tag]', params: { tag: tag.toLowerCase() } });
}

/** Renders text with every #tag highlighted and tappable (opens the tag page). */
export function RichCaption({ text, style, tagStyle, numberOfLines, onPressText }: {
  text: string;
  style?: any;
  tagStyle?: any;
  numberOfLines?: number;
  onPressText?: () => void;
}) {
  const parts: Array<{ text: string; tag?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(CAPTION_TAG_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    // must contain a letter to be a tag (matches the server's rules)
    if (/\p{L}/u.test(m[1])) parts.push({ text: m[0], tag: m[1] });
    else parts.push({ text: m[0] });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <Text style={style} numberOfLines={numberOfLines} onPress={onPressText}>
      {/* Nested pieces use RN's Text so they INHERIT the caption's colour/font.
          (The app's Text forces the theme ink colour — that made captions black on video.) */}
      {parts.map((p, i) => p.tag ? (
        <RNText key={i} style={[{ fontFamily: 'PlusJakartaSans_700Bold' }, tagStyle]} onPress={() => openHashtag(p.tag!)} suppressHighlighting>
          {p.text}
        </RNText>
      ) : (
        <RNText key={i}>{p.text}</RNText>
      ))}
    </Text>
  );
}

// ─── Owner menu: edit (15-minute window) / delete ────────────────────────────

export function useReelOwnerMenu({ showAlert, onDeleted }: {
  showAlert: (cfg: any) => void;
  onDeleted: (id: string) => void;
}) {
  return useCallback((reel: FeedReel) => {
    const mins = editMinutesLeft(reel);
    const confirmDelete = () => showAlert({
      title: 'Delete this post?',
      message: 'It will be removed from the feed and your store page.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await reelApi.deleteReel(reel.id);
              onDeleted(reel.id);
            } catch (e: any) {
              showAlert({ title: "Couldn't delete", message: e?.message ?? 'Please try again.', type: 'danger' });
            }
          },
        },
      ],
    });
    showAlert({
      title: 'Your post',
      message: mins > 0
        ? `You can edit the caption and tagged product for ${mins} more minute${mins === 1 ? '' : 's'}.`
        : 'The 15-minute edit window has closed. You can still delete it and post again.',
      type: 'question',
      buttons: [
        ...(mins > 0 ? [{ text: 'Edit post', onPress: () => router.push({ pathname: '/reel-edit/[reelId]', params: { reelId: reel.id } }) }] : []),
        { text: 'View insights', onPress: () => router.push('/reel-insights') },
        { text: 'Delete post', style: 'destructive', onPress: () => setTimeout(confirmDelete, 250) },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [showAlert, onDeleted]);
}

// ─── Shared mute (TikTok remembers it across reels) ──────────────────────────

let globalMuted = false;
const muteListeners = new Set<(m: boolean) => void>();
function useGlobalMute(): [boolean, () => void] {
  const [muted, setMuted] = useState(globalMuted);
  useEffect(() => {
    muteListeners.add(setMuted);
    return () => { muteListeners.delete(setMuted); };
  }, []);
  const toggle = useCallback(() => {
    globalMuted = !globalMuted;
    muteListeners.forEach((l) => l(globalMuted));
  }, []);
  return [muted, toggle];
}

// ─── Fake gradients (no extra native module needed) ──────────────────────────

function Fade({ edge, height }: { edge: 'top' | 'bottom'; height: number }) {
  const steps = 8;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, [edge]: 0, height }}>
      {Array.from({ length: steps }).map((_, i) => {
        // strongest at the screen edge, fading toward the middle
        const fromEdge = edge === 'bottom' ? steps - 1 - i : i;
        const opacity = 0.62 * Math.pow(1 - fromEdge / steps, 1.6);
        return <View key={i} style={{ height: height / steps, backgroundColor: `rgba(0,0,0,${opacity.toFixed(3)})` }} />;
      })}
    </View>
  );
}

// ─── Video ───────────────────────────────────────────────────────────────────

function ReelVideo({
  uri, poster, active, paused, muted, width, height, onProgress,
}: {
  uri: string; poster: string | null; active: boolean; paused: boolean; muted: boolean;
  width: number; height: number; onProgress: (p: number) => void;
}) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        setBuffering(status === 'loading');
        setFailed(status === 'error');
      }),
      player.addListener('playingChange', ({ isPlaying }) => { if (isPlaying) setStarted(true); }),
      player.addListener('timeUpdate', ({ currentTime }) => {
        const d = player.duration;
        if (d > 0) onProgress(Math.min(1, currentTime / d));
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  useEffect(() => {
    try { player.muted = muted; } catch {}
  }, [muted, player]);

  useEffect(() => {
    try {
      if (active && !paused) player.play();
      else player.pause();
    } catch {}
  }, [active, paused, player]);

  // Scrolled away: rewind so it starts fresh next time
  useEffect(() => {
    if (!active) {
      try { player.currentTime = 0; } catch {}
      onProgress(0);
    }
  }, [active, player]);

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {!started && poster && (
        <Image source={{ uri: poster }} style={{ position: 'absolute', width, height }} resizeMode="cover" />
      )}
      {(buffering || (!started && !poster)) && active && !failed && (
        <View pointerEvents="none" style={{ position: 'absolute', width, height, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
      {failed && (
        <View pointerEvents="none" style={{ position: 'absolute', width, height, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="cloud-offline-outline" size={34} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Couldn't play this video</Text>
        </View>
      )}
    </View>
  );
}

// ─── Photo stack (TikTok photo mode) ────────────────────────────────────────

const SLIDE_MS = 3500;

function PhotoSegments({ count, index, progress }: { count: number; index: number; progress: SharedValue<number> }) {
  const activeFill = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }));
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
          {i < index && <View style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }} />}
          {i === index && <Animated.View style={[{ height: '100%', backgroundColor: '#FFFFFF' }, activeFill]} />}
        </View>
      ))}
    </View>
  );
}

function ReelPhotos({
  urls, active, paused, width, height, onTap, segmentsBottom, counterTop,
}: {
  urls: string[]; active: boolean; paused: boolean; width: number; height: number;
  onTap: (e: any) => void; segmentsBottom: number; counterTop: number;
}) {
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const multi = urls.length > 1;

  // Warm the cache so swiping is instant
  useEffect(() => {
    urls.forEach((u) => { Image.prefetch(u).catch(() => {}); });
  }, [urls]);

  const goTo = useCallback((i: number) => {
    const next = ((i % urls.length) + urls.length) % urls.length;
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
    progress.value = 0;
  }, [urls.length, width]);

  // Auto-advance with a story-style progress bar; pauses on tap / when off screen
  useEffect(() => {
    if (!multi) return;
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      if (index !== 0) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        setIndex(0);
      }
      return;
    }
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(200, SLIDE_MS * (1 - progress.value));
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(goTo)(index + 1);
    });
    return () => cancelAnimation(progress);
  }, [active, paused, index, multi, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) {
      progress.value = 0;
      setIndex(i);
    }
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <FlatList
        ref={listRef}
        data={urls}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(u, i) => `${i}-${u}`}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <Pressable onPress={onTap} style={{ width, height }}>
            {/* blurred fill behind, sharp photo on top — no letterbox bars */}
            <Image source={{ uri: item }} style={{ position: 'absolute', width, height }} resizeMode="cover" blurRadius={28} />
            <View style={{ position: 'absolute', width, height, backgroundColor: 'rgba(0,0,0,0.35)' }} />
            <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />
          </Pressable>
        )}
      />

      {multi && (
        <>
          <View pointerEvents="none" style={{
            position: 'absolute', top: counterTop, right: 14,
            backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <Ionicons name="images" size={12} color="#FFFFFF" />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{index + 1}/{urls.length}</Text>
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: segmentsBottom }}>
            <PhotoSegments count={urls.length} index={index} progress={progress} />
          </View>
        </>
      )}
    </View>
  );
}

// ─── Action button ───────────────────────────────────────────────────────────

function Action({ icon, label, color = '#FFFFFF', onPress, accessibilityLabel }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label?: string; color?: string;
  onPress: () => void; accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityLabel={accessibilityLabel} style={{ alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={32} color={color} style={{ textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }} />
      {label !== undefined && (
        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── One reel, full screen ───────────────────────────────────────────────────

export const ReelItem = memo(function ReelItem({
  reel, isActive, isScreenFocused, mountMedia, width, height, topInset, bottomInset,
  currentUserId, onLike, onSave, onOwnerMenu, onComments, onFollow, onReport,
}: {
  reel: FeedReel;
  isActive: boolean;
  isScreenFocused: boolean;
  /** Only the active reel and its neighbours keep a video player alive */
  mountMedia: boolean;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  currentUserId: string;
  onLike: (id: string, liked: boolean) => void;
  onSave: (id: string, saved: boolean) => void;
  /** Owner's ⋯ menu (edit within 15 min / delete) */
  onOwnerMenu?: (reel: FeedReel) => void;
  onComments?: (reel: FeedReel) => void;
  onFollow?: (reel: FeedReel) => void;
  onReport?: (reel: FeedReel) => void;
}) {
  const [muted, toggleMute] = useGlobalMute();
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewCounted = useRef(false);

  const playing = isActive && isScreenFocused;
  const isOwn = reel.user_id === currentUserId;
  const isPhoto = reel.media_type === 'photo';

  // Fresh state each time it scrolls into view
  useEffect(() => {
    if (!isActive) { setPaused(false); setCaptionOpen(false); }
  }, [isActive]);

  // Count a view after it's been on screen for a moment
  useEffect(() => {
    if (!playing || viewCounted.current) return;
    const t = setTimeout(() => {
      viewCounted.current = true;
      reelApi.incrementView(reel.id).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [playing, reel.id]);

  useEffect(() => () => { if (singleTapTimer.current) clearTimeout(singleTapTimer.current); }, []);

  const like = (next: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLike(reel.id, next);
  };

  // Single tap = pause/play, double tap = like (with a heart where you tapped)
  const handleTap = (e: any) => {
    const now = Date.now();
    const { locationX = width / 2, locationY = height / 2 } = e?.nativeEvent ?? {};
    if (now - lastTap.current < 260) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      const id = now;
      setBursts((b) => [...b, { id, x: locationX, y: locationY }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 800);
      if (!reel.is_liked) like(true);
      return;
    }
    lastTap.current = now;
    singleTapTimer.current = setTimeout(() => setPaused((p) => !p), 260);
  };

  const share = () => {
    reelSocialApi.share(reel.id).catch(() => {});
    Share.share({
      message: `${reel.vendor_name} on Vendr${reel.caption ? `: ${reel.caption}` : ''}${reel.product_name ? `\n${reel.product_name} — ${formatPrice(reel.product_price ?? 0)}` : ''}`,
    }).catch(() => {});
  };

  const openVendor = () => router.push({ pathname: '/vendor/[id]', params: { id: reel.vendor_id } });

  const chatToBuy = () => {
    reelSocialApi.chatTap(reel.id).catch(() => {});
    openChat();
  };
  const messageVendor = () => {
    reelSocialApi.chatTap(reel.id).catch(() => {});
    router.push({ pathname: '/chat/[conversationId]', params: { vendorId: reel.vendor_id } });
  };
  const openChat = () => router.push({
    pathname: '/chat/[conversationId]',
    params: {
      vendorId: reel.vendor_id,
      productName: reel.product_name ?? undefined,
      productPrice: reel.product_price != null ? formatPrice(reel.product_price) : undefined,
    },
  });

  const segmentsBottom = bottomInset + 10;

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      {/* Media */}
      {isPhoto ? (
        <ReelPhotos
          urls={reel.image_urls}
          active={playing}
          paused={paused}
          width={width}
          height={height}
          onTap={handleTap}
          segmentsBottom={segmentsBottom}
          counterTop={topInset + 6}
        />
      ) : (
        <>
          {mountMedia && reel.video_url ? (
            <ReelVideo
              uri={reel.video_url}
              poster={reel.thumbnail_url}
              active={playing}
              paused={paused}
              muted={muted}
              width={width}
              height={height}
              onProgress={setProgress}
            />
          ) : (
            reel.thumbnail_url
              ? <Image source={{ uri: reel.thumbnail_url }} style={{ width, height }} resizeMode="cover" />
              : <View style={{ width, height, backgroundColor: '#0C0A09' }} />
          )}
          <Pressable onPress={handleTap} style={{ position: 'absolute', top: 0, left: 0, width, height }} />
        </>
      )}

      <Fade edge="top" height={topInset + 70} />
      <Fade edge="bottom" height={Math.min(340, height * 0.45)} />

      {/* Paused */}
      {paused && (
        <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={38} color="rgba(255,255,255,0.95)" style={{ marginLeft: 5 }} />
          </View>
        </Animated.View>
      )}

      {/* Double-tap hearts */}
      {bursts.map((b) => (
        <Animated.View
          key={b.id}
          entering={ZoomIn.springify().damping(9)}
          exiting={FadeOut.duration(250)}
          pointerEvents="none"
          style={{ position: 'absolute', left: b.x - 48, top: b.y - 48, transform: [{ rotate: `${(b.id % 30) - 15}deg` }] }}
        >
          <Ionicons name="heart" size={96} color="#FF3B5C" style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 }} />
        </Animated.View>
      ))}

      {/* Right action rail */}
      <View style={{ position: 'absolute', right: 10, bottom: bottomInset + 96, alignItems: 'center', gap: 20 }}>
        <TouchableOpacity onPress={openVendor} activeOpacity={0.8} accessibilityLabel={`Open ${reel.vendor_name}`}>
          <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#FFFFFF', overflow: 'hidden', backgroundColor: '#1C1917', alignItems: 'center', justifyContent: 'center' }}>
            {reel.vendor_logo
              ? <Image source={{ uri: reel.vendor_logo }} style={{ width: '100%', height: '100%' }} />
              : <Ionicons name="storefront" size={22} color="#E8521A" />}
          </View>
        </TouchableOpacity>
        {/* TikTok-style follow badge (hidden on your own posts / once following) */}
        {!isOwn && onFollow && !reel.is_following ? (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onFollow(reel); }}
            accessibilityLabel={`Follow ${reel.vendor_name}`}
            hitSlop={8}
            style={{ marginTop: -26, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF3B5C', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' }}
          >
            <Ionicons name="add" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View pointerEvents="none" style={{ marginTop: -26, width: 22, height: 22, borderRadius: 11, backgroundColor: reel.is_following ? '#FFFFFF' : '#E8521A', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={reel.is_following ? 'checkmark' : 'storefront'} size={reel.is_following ? 14 : 11} color={reel.is_following ? '#FF3B5C' : '#FFFFFF'} />
          </View>
        )}

        <Action
          icon={reel.is_liked ? 'heart' : 'heart-outline'}
          color={reel.is_liked ? '#FF3B5C' : '#FFFFFF'}
          label={formatCount(reel.like_count)}
          onPress={() => like(!reel.is_liked)}
          accessibilityLabel={reel.is_liked ? 'Unlike' : 'Like'}
        />
        <Action
          icon={reel.is_saved ? 'bookmark' : 'bookmark-outline'}
          color={reel.is_saved ? '#F5A623' : '#FFFFFF'}
          label={formatCount(reel.save_count)}
          onPress={() => onSave(reel.id, !reel.is_saved)}
          accessibilityLabel={reel.is_saved ? 'Remove from saved' : 'Save'}
        />
        {onComments && (
          <Action icon="chatbubble-ellipses" label={formatCount(reel.comment_count)} onPress={() => onComments(reel)} accessibilityLabel={`Comments (${reel.comment_count})`} />
        )}
        <Action icon="arrow-redo" label={reel.share_count > 0 ? formatCount(reel.share_count) : 'Share'} onPress={share} accessibilityLabel="Share" />
        {!isPhoto && (
          <Action icon={muted ? 'volume-mute' : 'volume-high'} onPress={toggleMute} accessibilityLabel={muted ? 'Unmute' : 'Mute'} />
        )}
        {isOwn && onOwnerMenu && (
          <Action icon="ellipsis-horizontal" onPress={() => onOwnerMenu(reel)} accessibilityLabel="Post options" />
        )}
        {!isOwn && onReport && (
          <Action icon="ellipsis-horizontal" onPress={() => onReport(reel)} accessibilityLabel="Report post" />
        )}
      </View>

      {/* Bottom info */}
      <View style={{ position: 'absolute', left: 14, right: 84, bottom: bottomInset + 26 }}>
        <TouchableOpacity onPress={openVendor} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>
            {reel.vendor_name}
          </Text>
          {reel.vendor_verified && <Ionicons name="checkmark-circle" size={16} color="#3DDC84" />}
          {!!reel.vendor_category && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <Text style={{ fontSize: 10.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF' }}>{reel.vendor_category}</Text>
            </View>
          )}
        </TouchableOpacity>

        {!!reel.caption && (
          <View style={{ marginBottom: 10 }}>
            <RichCaption
              text={reel.caption}
              onPressText={() => setCaptionOpen((o) => !o)}
              numberOfLines={captionOpen ? 10 : 2}
              style={{ fontSize: 14.5, lineHeight: 21, color: '#FFFFFF', fontFamily: 'PlusJakartaSans_500Medium', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }}
              tagStyle={{ color: '#FFFFFF' }}
            />
          </View>
        )}

        {!!reel.product_name && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%',
            backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
            borderRadius: 14, padding: 8, paddingRight: isOwn ? 12 : 8,
          }}>
            {reel.product_image
              ? <Image source={{ uri: reel.product_image }} style={{ width: 40, height: 40, borderRadius: 9 }} />
              : <View style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetag" size={18} color="#FFFFFF" />
                </View>}
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF' }}>{reel.product_name}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFB38A' }}>{formatPrice(reel.product_price ?? 0)}</Text>
            </View>
            {!isOwn && (
              <TouchableOpacity onPress={chatToBuy} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8521A', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }}>
                <Ionicons name="chatbubble-ellipses" size={13} color="#FFFFFF" />
                <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Chat to buy</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!reel.product_name && !isOwn && (
          <TouchableOpacity onPress={messageVendor} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Message vendor</Text>
          </TouchableOpacity>
        )}

        {(reel.distance_km != null || !!reel.vendor_city) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Ionicons name="location" size={12} color="#FFB38A" />
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
              {reel.distance_km != null ? `${reel.distance_km < 1 ? '<1' : reel.distance_km >= 100 ? Math.round(reel.distance_km) : reel.distance_km} km away` : ''}
              {reel.distance_km != null && reel.vendor_city ? ' · ' : ''}{reel.vendor_city ?? ''}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <Ionicons name={isPhoto ? 'images-outline' : 'play-outline'} size={12} color="rgba(255,255,255,0.75)" />
          <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)' }}>
            {formatCount(reel.view_count)} views{isPhoto ? ` · ${reel.image_urls.length} photo${reel.image_urls.length === 1 ? '' : 's'}` : ''}{reel.edited_at ? ' · edited' : ''}
          </Text>
        </View>
      </View>

      {/* Video progress */}
      {!isPhoto && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset, height: 2.5, backgroundColor: 'rgba(255,255,255,0.22)' }}>
          <View style={{ height: '100%', width: `${Math.round(progress * 100)}%`, backgroundColor: '#FFFFFF' }} />
        </View>
      )}
    </View>
  );
});
