import { useState, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { reviewApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { T, useTheme } from '../constants/theme';

interface ReviewLeft {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  vendor_id: string;
  vendor_name: string;
}

interface ReviewReceived {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  useTheme();
  return (  
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={size} color="#F5A623" />
      ))}
    </View>
  );
}

function EmptyState({ icon, title, subtitle, actionLabel, onAction }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 22,
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={30} color={T.ink4} />
      </View>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink }}>{title}</Text>
      <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 22 }}>
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: 'white' }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Card: review I left for a store ──────────────────────────────────────────
function ReviewLeftCard({ item }: { item: ReviewLeft }) {
  useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: item.vendor_id } })}
      activeOpacity={0.85}
      style={{
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
        borderRadius: 20, padding: 16, gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.ink }}>
            {item.vendor_name}
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3 }}>
            {new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={T.ink4} style={{ marginTop: 2 }} />
      </View>
      <Stars rating={item.rating} />
      {item.comment ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, lineHeight: 20 }}>
          {item.comment}
        </Text>
      ) : (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3, fontStyle: 'italic' }}>
          No comment
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Card: review someone left for my store ───────────────────────────────────
function ReviewReceivedCard({ item }: { item: ReviewReceived }) {
  useTheme();
  return (
    <View style={{
      backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
      borderRadius: 20, padding: 16, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {/* Avatar initial */}
          <View style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: 'rgba(232,82,26,0.12)',
            borderWidth: 1, borderColor: 'rgba(232,82,26,0.2)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.primaryInk }}>
              {item.reviewer_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: T.ink }}>
              {item.reviewer_name}
            </Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3 }}>
              {new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>
        {/* Rating badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: 'rgba(245,166,35,0.12)',
          borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
          borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
        }}>
          <Ionicons name="star" size={11} color="#F5A623" />
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: T.goldInk }}>
            {item.rating}.0
          </Text>
        </View>
      </View>
      <Stars rating={item.rating} />
      {item.comment ? (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, lineHeight: 20 }}>
          {item.comment}
        </Text>
      ) : (
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3, fontStyle: 'italic' }}>
          No comment left
        </Text>
      )}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function MyReviewsScreen() {
  useTheme();
  const { user, isVendor } = useAuthStore();

  const [tab, setTab] = useState<'left' | 'received'>('left');
  const [reviewsLeft, setReviewsLeft] = useState<ReviewLeft[]>([]);
  const [reviewsReceived, setReviewsReceived] = useState<ReviewReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number>(0);

  useFocusEffect(useCallback(() => {
    const fetchAll = async () => {
      if (!user?.id) return;
      setLoading(true);

      try {
        // Fetch reviews I left (with vendor details)
        const leftRes = await reviewApi.getMyReviews();
        const leftData = leftRes.data || [];
        setReviewsLeft(leftData);

        // If vendor — fetch reviews received for their store
        if (isVendor) {
          const receivedRes = await reviewApi.getReviewsReceived();
          const receivedData = receivedRes.data || [];

          // Transform to ReviewReceived format
          const shaped: ReviewReceived[] = (receivedData as any[]).map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            reviewer_name: r.reviewer_name ?? 'Anonymous',
            reviewer_avatar: r.reviewer_avatar ?? null,
          }));
          setReviewsReceived(shaped);

          if (shaped.length > 0) {
            const avg = shaped.reduce((sum, r) => sum + r.rating, 0) / shaped.length;
            setAvgRating(Math.round(avg * 10) / 10);
          } else {
            setAvgRating(0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
        // Optionally show error toast
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.id, isVendor]));

  const totalLeft = reviewsLeft.length;
  const totalReceived = reviewsReceived.length;

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: T.line, gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: T.ink }}>Reviews</Text>
          {isVendor && avgRating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: T.goldInk }}>
                {avgRating} avg · {totalReceived} store review{totalReceived !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : (
        <>
          {/* Tabs — only shown for vendors */}
          {isVendor && (
            <View style={{
              flexDirection: 'row', gap: 8,
              paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
            }}>
              <TouchableOpacity
                onPress={() => setTab('received')}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: tab === 'received' ? '#E8521A' : T.surface,
                  borderWidth: 1, borderColor: tab === 'received' ? '#E8521A' : T.line,
                }}
              >
                <Ionicons name="storefront-outline" size={14} color={tab === 'received' ? 'white' : T.ink2} />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: tab === 'received' ? 'white' : T.ink2 }}>
                  My Store
                </Text>
                {totalReceived > 0 && (
                  <View style={{
                    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
                    backgroundColor: tab === 'received' ? 'rgba(255,255,255,0.25)' : 'rgba(232,82,26,0.15)',
                  }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: tab === 'received' ? 'white' : T.primaryInk }}>
                      {totalReceived}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTab('left')}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: tab === 'left' ? '#E8521A' : T.surface,
                  borderWidth: 1, borderColor: tab === 'left' ? '#E8521A' : T.line,
                }}
              >
                <Ionicons name="pencil-outline" size={14} color={tab === 'left' ? 'white' : T.ink2} />
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: tab === 'left' ? 'white' : T.ink2 }}>
                  Left by Me
                </Text>
                {totalLeft > 0 && (
                  <View style={{
                    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
                    backgroundColor: tab === 'left' ? 'rgba(255,255,255,0.25)' : 'rgba(232,82,26,0.15)',
                  }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: tab === 'left' ? 'white' : T.primaryInk }}>
                      {totalLeft}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {isVendor ? (
            tab === 'received' ? (
              totalReceived === 0 ? (
                <EmptyState
                  icon="star-outline"
                  title="No reviews yet"
                  subtitle="Customers who visit your store will leave reviews here."
                />
              ) : (
                <FlatList
                  data={reviewsReceived}
                  keyExtractor={r => r.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
                  renderItem={({ item }) => <ReviewReceivedCard item={item} />}
                />
              )
            ) : (
              totalLeft === 0 ? (
                <EmptyState
                  icon="pencil-outline"
                  title="No reviews left"
                  subtitle="Reviews you leave on other stores will appear here."
                  actionLabel="Browse Vendors"
                  onAction={() => router.push('/(tabs)')}
                />
              ) : (
                <FlatList
                  data={reviewsLeft}
                  keyExtractor={r => r.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
                  renderItem={({ item }) => <ReviewLeftCard item={item} />}
                />
              )
            )
          ) : (
            // Buyer — only see reviews they left
            totalLeft === 0 ? (
              <EmptyState
                icon="star-outline"
                title="No reviews yet"
                subtitle="When you leave reviews on vendor stores, they'll appear here."
                actionLabel="Browse Vendors"
                onAction={() => router.push('/(tabs)')}
              />
            ) : (
              <FlatList
                data={reviewsLeft}
                keyExtractor={r => r.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
                renderItem={({ item }) => <ReviewLeftCard item={item} />}
              />
            )
          )}
        </>
      )}
    </View>
  );
}