import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Image,
  FlatList, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { userApi, orderApi, reviewApi, savedVendorApi, vendorApi, reelApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const { width: SW } = Dimensions.get('window');
const REEL_SIZE = (SW - 48) / 3;

interface ReelThumb {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  like_count: number;
  view_count: number;
  caption: string | null;
  vendor_id?: string;
}

function ReelGrid({ reels, vendorId, onDelete }: { reels: ReelThumb[]; vendorId: string; onDelete?: (reel: ReelThumb) => void }) {
  const { width: SW } = Dimensions.get('window');
  const REEL_SIZE = (SW - 48) / 3;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {reels.map((reel, idx) => (
        <TouchableOpacity
          key={reel.id}
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/reel/[reelId]',
            params: { reelId: reel.id, vendorId: reel.vendor_id ?? vendorId, startIndex: String(idx) },
          })}
          onLongPress={() => onDelete?.(reel)}
          delayLongPress={400}
          style={{ width: REEL_SIZE, height: REEL_SIZE * 1.5, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A1208' }}
        >
          {reel.thumbnail_url ? (
            <Image source={{ uri: reel.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play-circle-outline" size={28} color="#3D3026" />
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="eye-outline" size={10} color="white" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: 'white' }}>
              {reel.view_count > 999 ? `${(reel.view_count / 1000).toFixed(1)}k` : reel.view_count}
            </Text>
          </View>
          {/* Long-press to delete */}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ProfileViewScreen() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [reels, setReels] = useState<ReelThumb[]>([]);
  const [savedReels, setSavedReels] = useState<ReelThumb[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState({ orders: 0, reviews: 0, saved: 0, reels: 0 });
  const [loading, setLoading] = useState(true);
  const [reelTab, setReelTab] = useState<'mine' | 'saved'>('mine');

  const handleDeleteReel = (reel: ReelThumb) => {
    Alert.alert('Delete Reel?', 'This will permanently remove the reel and its video.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setReels(prev => prev.filter(r => r.id !== reel.id));
          try {
            // Backend will handle both DB deletion and storage cleanup
            await reelApi.deleteReel(reel.id);
          } catch (error) {
            console.error('Failed to delete reel:', error);
            // Optionally refresh reels list on error or show toast
          }
        },
      },
    ]);
  };

  const userId = user?.id;
  const name = profile?.full_name ?? user?.full_name ?? 'Vendr User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const isVendor = !!vendorId; // Set after fetch based on vendorId

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Get user profile with stats
        const profileRes = await userApi.getProfile();
        const profileData = profileRes.data;
        if (profileData) setProfile(profileData);

        // Determine if vendor
        const isVendor = !!profileData?.vendor?.id;
        const vendorId = profileData?.vendor?.id || null;
        setVendorId(vendorId);

        // Stats from profile
        const stats = profileData?.stats || { orders: 0, reviews: 0, saved: 0 };

        let reelsList: ReelThumb[] = [];
        let savedList: ReelThumb[] = [];

        // If vendor — fetch reels and saved reels
        if (vendorId) {
          const [reelsRes, savedReelsRes] = await Promise.all([
            reelApi.getReels(vendorId),
            reelApi.getSavedReels(),
          ]);

          reelsList = reelsRes.data || [];
          savedList = savedReelsRes.data || [];
          setReels(reelsList);
          setSavedReels(savedList);
        }

        // Set stats with reels count
        setStats({
          orders: stats.orders,
          reviews: stats.reviews,
          saved: stats.saved,
          reels: reelsList.length,
        });
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [userId]));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', flex: 1 }}>My Profile</Text>
        <TouchableOpacity
          onPress={() => router.push('/edit-profile')}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="pencil-outline" size={18} color="#9A8570" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 28 }}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 88, height: 88, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(232,82,26,0.4)', marginBottom: 14 }}
            />
          ) : (
            <View style={{
              width: 88, height: 88, borderRadius: 28,
              backgroundColor: 'rgba(232,82,26,0.15)', borderWidth: 2, borderColor: 'rgba(232,82,26,0.3)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#E8521A' }}>{initials}</Text>
            </View>
          )}

          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', marginBottom: 4 }}>{name}</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', marginBottom: 12 }}>
            {user?.email}
          </Text>

          {/* Role badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
            backgroundColor: isVendor ? 'rgba(245,166,35,0.15)' : '#1A1208',
            borderWidth: 1, borderColor: isVendor ? 'rgba(245,166,35,0.3)' : '#3D3026',
          }}>
            <Ionicons name={isVendor ? 'storefront-outline' : 'person-outline'} size={12} color={isVendor ? '#F5A623' : '#9A8570'} />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: isVendor ? '#F5A623' : '#9A8570' }}>
              {isVendor ? 'Vendor' : 'Buyer'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 28 }}>
          {[
            { label: 'Orders',  value: stats.orders,  icon: 'bag-outline'       as const, route: '/orders'  },
            { label: 'Reviews', value: stats.reviews, icon: 'star-outline'      as const, route: '/reviews' },
            { label: 'Saved',   value: stats.saved,   icon: 'bookmark-outline'  as const, route: '/saved'   },
            ...(isVendor ? [{ label: 'Reels', value: stats.reels, icon: 'play-circle-outline' as const, route: null }] : []),
          ].map(stat => (
            <TouchableOpacity
              key={stat.label}
              onPress={() => stat.route && router.push(stat.route as any)}
              activeOpacity={stat.route ? 0.75 : 1}
              style={{
                flex: 1, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                borderRadius: 18, padding: 12, alignItems: 'center', gap: 4,
              }}
            >
              <Ionicons name={stat.icon} size={18} color="#9A8570" />
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>{stat.value}</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick actions */}
        <View style={{ marginHorizontal: 20, gap: 10, marginBottom: 28 }}>
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 18, padding: 16 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(245,166,35,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-outline" size={20} color="#F5A623" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>Edit Profile</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 1 }}>Update name, photo and phone</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#3D3026" />
          </TouchableOpacity>

          {isVendor && vendorId && (
            <>
              <TouchableOpacity
                onPress={() => router.push('/my-stores')}
                activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(232,82,26,0.08)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.25)', borderRadius: 18, padding: 16 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(232,82,26,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="storefront-outline" size={20} color="#E8521A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>Manage Store</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 1 }}>Products, orders and store settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#E8521A" />
              </TouchableOpacity>

              {/* Pro Plan Upgrade */}
              <TouchableOpacity
                onPress={() => Alert.alert('Upgrade to Pro', 'Pro plan features coming soon!')}
                activeOpacity={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(45,134,83,0.08)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.25)', borderRadius: 18, padding: 16 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(45,134,83,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="diamond-outline" size={20} color="#2D8653" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>Upgrade to Pro</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 1 }}>Unlock premium features & boost visibility</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#2D8653" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Reels section */}
        {(isVendor || savedReels.length > 0) && (
          <View style={{ marginHorizontal: 20 }}>
            {/* Tab row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              {/* My Reels tab — vendor only */}
              {isVendor && (
                <TouchableOpacity
                  onPress={() => setReelTab('mine')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
                    backgroundColor: reelTab === 'mine' ? '#E8521A' : '#1A1208',
                    borderWidth: 1, borderColor: reelTab === 'mine' ? '#E8521A' : '#2A1F14',
                  }}
                >
                  <Ionicons name="play-circle-outline" size={14} color={reelTab === 'mine' ? 'white' : '#9A8570'} />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: reelTab === 'mine' ? 'white' : '#9A8570' }}>My Reels</Text>
                  {reels.length > 0 && (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: reelTab === 'mine' ? 'rgba(255,255,255,0.25)' : 'rgba(232,82,26,0.15)' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, color: reelTab === 'mine' ? 'white' : '#E8521A' }}>{reels.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Saved Reels tab — everyone */}
              <TouchableOpacity
                onPress={() => setReelTab('saved')}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
                  backgroundColor: reelTab === 'saved' ? '#E8521A' : '#1A1208',
                  borderWidth: 1, borderColor: reelTab === 'saved' ? '#E8521A' : '#2A1F14',
                }}
              >
                <Ionicons name="bookmark-outline" size={14} color={reelTab === 'saved' ? 'white' : '#9A8570'} />
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: reelTab === 'saved' ? 'white' : '#9A8570' }}>Saved</Text>
                {savedReels.length > 0 && (
                  <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: reelTab === 'saved' ? 'rgba(255,255,255,0.25)' : 'rgba(232,82,26,0.15)' }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, color: reelTab === 'saved' ? 'white' : '#E8521A' }}>{savedReels.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Post reel button — vendor, my reels tab */}
              {isVendor && reelTab === 'mine' && (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/reel-upload', params: { vendorId: vendorId ?? '' } })}
                  activeOpacity={0.85}
                  style={{
                    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E8521A',
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
                  }}
                >
                  <Ionicons name="add" size={15} color="#E8521A" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#E8521A' }}>Post</Text>
                </TouchableOpacity>
              )}
            </View>

            {reelTab === 'mine' ? (
              /* ── My Reels grid ── */
              reels.length === 0 ? (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/reel-upload', params: { vendorId: vendorId ?? '' } })}
                  activeOpacity={0.85}
                  style={{
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: '#2A1F14', borderRadius: 20,
                    borderStyle: 'dashed', paddingVertical: 40, gap: 12,
                  }}
                >
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="videocam-outline" size={26} color="#3D3026" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#FDF6EC' }}>Post your first reel</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', textAlign: 'center', paddingHorizontal: 20 }}>
                    Share short videos of your products to attract buyers
                  </Text>
                </TouchableOpacity>
              ) : (
                <ReelGrid reels={reels} vendorId={vendorId ?? ''} onDelete={handleDeleteReel} />
              )
            ) : (
              /* ── Saved Reels grid ── */
              savedReels.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="bookmark-outline" size={26} color="#3D3026" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#FDF6EC' }}>No saved reels yet</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', textAlign: 'center' }}>
                    Bookmark reels you like and they will appear here
                  </Text>
                </View>
              ) : (
                <ReelGrid reels={savedReels} vendorId={savedReels[0]?.vendor_id ?? ''} />
              )
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}