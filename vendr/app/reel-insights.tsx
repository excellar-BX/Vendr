import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ui/StyledText';
import { formatCount, openHashtag } from '../components/reel/ReelViewer';
import { reelSocialApi } from '../lib/api';
import { T, useTheme } from '../constants/theme';

interface PostStat {
  id: string; vendor_id: string; media_type: string; thumbnail_url: string | null; caption: string | null;
  is_active: boolean; created_at: string;
  views: number; likes: number; saves: number; comments: number; shares: number; chats: number;
}
interface Insights {
  stores: Array<{ id: string; name: string; followers: number }>;
  followers: number;
  totals: { posts: number; views: number; likes: number; saves: number; comments: number; shares: number; chats: number };
  engagement_rate: number;
  top_hashtags: Array<{ tag: string; posts: number; avg_views: number }>;
  posts: PostStat[];
}

type Sort = 'views' | 'chats' | 'recent';

/** How a vendor's posts are doing — views, engagement, chats started, best hashtags. */
export default function ReelInsightsScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Insights | null>(null);
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('views');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const { data: d } = await reelSocialApi.insights(storeId);
      setData(d);
    } catch (e: any) {
      setError(e?.statusCode === 404 ? 'Open a store to see post insights.' : "Couldn't load insights. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/reels'));

  const Stat = ({ icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) => (
    <View style={{ flexBasis: '31%', flexGrow: 1, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 12, gap: 6 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: `${accent}1F`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, color: T.ink3 }}>{label}</Text>
    </View>
  );

  const posts = data ? [...data.posts].sort((a, b) =>
    sort === 'views' ? b.views - a.views : sort === 'chats' ? b.chats - a.chats : b.created_at.localeCompare(a.created_at)
  ) : [];

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 8 }}>
        <TouchableOpacity onPress={goBack} accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={T.ink} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>Post insights</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={T.primary} /></View>
      ) : error || !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 }}>
          <Ionicons name="stats-chart-outline" size={38} color={T.ink4} />
          <Text style={{ fontSize: 15, color: T.ink, textAlign: 'center' }}>{error}</Text>
          {!error?.startsWith('Open') && (
            <TouchableOpacity onPress={() => load()} style={{ backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30, gap: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.primary} colors={[T.primary]} />}
        >
          {/* Store switcher (only when running several stores) */}
          {data.stores.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[{ id: undefined as string | undefined, name: 'All stores' }, ...data.stores].map((st) => {
                const active = storeId === st.id;
                return (
                  <TouchableOpacity key={st.id ?? 'all'} onPress={() => setStoreId(st.id)}
                    style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', borderWidth: 1, borderColor: active ? T.ink : T.line, backgroundColor: active ? T.ink : T.surface }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: active ? T.canvas : T.ink2 }}>{st.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Headline */}
          <View style={{ backgroundColor: T.heroBg, borderRadius: 22, padding: 18, gap: 4 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Total views · {data.totals.posts} post{data.totals.posts === 1 ? '' : 's'}</Text>
            <Text style={{ fontSize: 34, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', letterSpacing: -0.5 }}>{formatCount(data.totals.views)}</Text>
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{formatCount(data.followers)}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Followers</Text>
              </View>
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFB38A' }}>{(data.engagement_rate * 100).toFixed(1)}%</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Engagement</Text>
              </View>
              <View>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>{formatCount(data.totals.chats)}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Chats started</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat icon="heart" label="Likes" value={formatCount(data.totals.likes)} accent="#FF3B5C" />
            <Stat icon="bookmark" label="Saves" value={formatCount(data.totals.saves)} accent="#F5A623" />
            <Stat icon="chatbubble-ellipses" label="Comments" value={formatCount(data.totals.comments)} accent="#2563EB" />
            <Stat icon="arrow-redo" label="Shares" value={formatCount(data.totals.shares)} accent="#2D8653" />
            <Stat icon="chatbubbles" label="Chat to buy" value={formatCount(data.totals.chats)} accent="#E8521A" />
            <Stat icon="people" label="Followers" value={formatCount(data.followers)} accent="#7C3AED" />
          </View>

          {data.top_hashtags.length > 0 && (
            <View>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink, marginBottom: 4 }}>Your best hashtags</Text>
              <Text style={{ fontSize: 12.5, color: T.ink3, marginBottom: 10 }}>Average views per post that used them</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {data.top_hashtags.map((t) => (
                  <TouchableOpacity key={t.tag} onPress={() => openHashtag(t.tag)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>#{t.tag}</Text>
                    <Text style={{ fontSize: 11.5, color: T.ink3 }}>{formatCount(t.avg_views)} avg</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Posts</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['views', 'chats', 'recent'] as Sort[]).map((k) => (
                  <TouchableOpacity key={k} onPress={() => setSort(k)}
                    style={{ paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: sort === k ? T.primarySoft : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: sort === k ? T.primaryInk : T.ink3 }}>
                      {k === 'views' ? 'Top' : k === 'chats' ? 'Most chats' : 'Newest'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {posts.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
                <Text style={{ fontSize: 14, color: T.ink3 }}>No posts yet.</Text>
                <TouchableOpacity onPress={() => router.push('/reel-upload')} style={{ backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Create a post</Text>
                </TouchableOpacity>
              </View>
            ) : posts.map((p) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/reel/[reelId]', params: { reelId: p.id, vendorId: p.vendor_id } })}
                style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line }}
              >
                <View style={{ width: 58, height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: T.surface2 }}>
                  {p.thumbnail_url && <Image source={{ uri: p.thumbnail_url }} style={{ width: '100%', height: '100%' }} />}
                  {!p.is_active && (
                    <View style={{ position: 'absolute', inset: 0 as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="eye-off" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, color: T.ink }}>
                    {p.caption || (p.media_type === 'photo' ? 'Photo post' : 'Video post')}
                  </Text>
                  {!p.is_active && <Text style={{ fontSize: 11.5, color: T.dangerInk, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Hidden (under review)</Text>}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {([['eye-outline', p.views], ['heart-outline', p.likes], ['chatbubble-outline', p.comments], ['chatbubbles-outline', p.chats]] as const).map(([icon, n]) => (
                      <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name={icon} size={13} color={T.ink3} />
                        <Text style={{ fontSize: 12.5, fontFamily: 'PlusJakartaSans_600SemiBold', color: T.ink2 }}>{formatCount(n)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
