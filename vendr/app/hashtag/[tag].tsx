import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, useWindowDimensions, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui/StyledText';
import { FeedReel, normalizeReel, formatCount, openHashtag } from '../../components/reel/ReelViewer';
import { reelApi, hashtagApi, HashtagSummary } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

const PAGE = 30;
const GAP = 3;

/** Everything posted with one #hashtag, TikTok-style grid. */
export default function HashtagScreen() {
  useTheme();
  const { tag: rawTag } = useLocalSearchParams<{ tag: string }>();
  const tag = (rawTag ?? '').replace(/^#+/, '').toLowerCase();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cell = (width - GAP * 2) / 3;

  const [stats, setStats] = useState<HashtagSummary | null>(null);
  const [related, setRelated] = useState<HashtagSummary[]>([]);
  const [reels, setReels] = useState<FeedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!tag) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    try {
      const [statsRes, reelsRes, trendRes] = await Promise.allSettled([
        hashtagApi.stats(tag),
        reelApi.getReels({ hashtag: tag, limit: PAGE, offset: 0 }),
        hashtagApi.trending(12),
      ]);
      if (reelsRes.status === 'rejected') throw reelsRes.reason;
      const page = ((reelsRes.value.data ?? []) as any[]).map(normalizeReel);
      setReels(page);
      setHasMore(page.length === PAGE);
      offsetRef.current = page.length;
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (trendRes.status === 'fulfilled') {
        setRelated(((trendRes.value.data ?? []) as HashtagSummary[]).filter((t) => t.tag !== tag).slice(0, 10));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tag]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const { data } = await reelApi.getReels({ hashtag: tag, limit: PAGE, offset: offsetRef.current });
      const page = ((data ?? []) as any[]).map(normalizeReel);
      setHasMore(page.length === PAGE);
      offsetRef.current += page.length;
      setReels((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id))];
      });
    } catch { /* retried on next scroll */ } finally {
      setLoadingMore(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/reels'));

  const header = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: T.primarySoft, borderWidth: 1, borderColor: T.primaryBorder, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 38, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.primary }}>#</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink, letterSpacing: -0.4 }}>#{tag}</Text>
          <Text style={{ fontSize: 13.5, color: T.ink3, marginTop: 2 }}>
            {stats ? `${formatCount(stats.post_count)} post${stats.post_count === 1 ? '' : 's'} · ${formatCount(stats.view_count)} views` : ' '}
          </Text>
        </View>
      </View>

      {related.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink3, letterSpacing: 0.8, marginBottom: 8 }}>TRENDING</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {related.map((t) => (
              <TouchableOpacity
                key={t.tag}
                onPress={() => router.setParams({ tag: t.tag })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>#{t.tag}</Text>
                <Text style={{ fontSize: 11.5, color: T.ink3 }}>{formatCount(t.post_count)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  const renderCell = ({ item }: { item: FeedReel }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/reel/[reelId]', params: { reelId: item.id, hashtag: tag } })}
      style={{ width: cell, height: cell * 1.5, backgroundColor: T.surface2 }}
    >
      {item.thumbnail_url
        ? <Image source={{ uri: item.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play-circle-outline" size={28} color={T.ink4} /></View>}
      {item.media_type === 'photo' && (
        <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: 4 }}>
          <Ionicons name="albums" size={13} color="white" />
        </View>
      )}
      <View style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Ionicons name="play-outline" size={12} color="white" style={{ textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }} />
        <Text style={{ fontSize: 11.5, fontFamily: 'PlusJakartaSans_700Bold', color: 'white', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>{formatCount(item.view_count)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 8 }}>
        <TouchableOpacity onPress={goBack} accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={T.primary} /></View>
      ) : error && reels.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.ink4} />
          <Text style={{ fontSize: 16, color: T.ink, textAlign: 'center' }}>Couldn't load #{tag}</Text>
          <TouchableOpacity onPress={() => load()} style={{ backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          numColumns={3}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={header}
          renderItem={renderCell}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.primary} colors={[T.primary]} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 50, paddingHorizontal: 36, gap: 8 }}>
              <Ionicons name="pricetags-outline" size={38} color={T.ink4} />
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>No posts with #{tag} yet</Text>
              <Text style={{ fontSize: 13.5, color: T.ink3, textAlign: 'center' }}>Vendors: add #{tag} to your caption to show up here.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={T.primary} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </View>
  );
}

