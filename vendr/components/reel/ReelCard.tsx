import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '../ui/StyledText';
import { formatDistance } from '../../lib/utils';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const categoryConfig: Record<string, { color: string; icon: IoniconsName }> = {
  'Food & Drinks':  { color: '#E8521A', icon: 'fast-food-outline' },
  'Fashion':        { color: '#F5A623', icon: 'shirt-outline' },
  'Accessories':    { color: '#9A8570', icon: 'diamond-outline' },
  'Beauty & Hair':  { color: '#E85599', icon: 'cut-outline' },
  'Electronics':    { color: '#5599E8', icon: 'phone-portrait-outline' },
  'Groceries':      { color: '#2D8653', icon: 'basket-outline' },
};

interface ReelCardProps {
  reel: {
    id: string;
    vendor_id: string;
    vendor_shop_name: string | null;
    vendor_category: string | null;
    vendor_lat: number | null;
    vendor_lng: number | null;
    vendor_logo_url: string | null;
    vendor_banner_url: string | null;
    vendor_avatar_url: string | null;
    vendor_is_verified: boolean | null;
    vendor_rating: number | null;
    video_url: string | null;
    thumbnail_url: string | null;
    caption: string | null;
    product_id: string | null;
    distance: number | null;
  };
  cardWidth: number;
}

export function ReelCard({ reel, cardWidth }: ReelCardProps) {
  const cfg = categoryConfig[reel.vendor_category ?? ''] ?? { color: '#E8521A', icon: 'videocam-outline' as IoniconsName };

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/reel/[reelId]', params: { reelId: reel.id } })}
      activeOpacity={0.88}
      style={{
        width: cardWidth,
        backgroundColor: '#1A1208',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A1F14',
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
      }}
    >
      {/* Thumbnail / Video Preview */}
      <View style={{ height: 180, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {reel.thumbnail_url ? (
          <Image source={{ uri: reel.thumbnail_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${cfg.color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={cfg.icon} size={24} color={cfg.color} />
          </View>
        )}

        {/* Play button overlay */}
        <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 24, padding: 8 }}>
          <Ionicons name="play" size={20} color="white" />
        </View>

        {/* Verified badge */}
        {reel.vendor_is_verified && (
          <View style={{
            position: 'absolute', top: 8, right: 8,
            backgroundColor: 'rgba(45,134,83,0.2)', borderRadius: 8,
            borderWidth: 1, borderColor: 'rgba(45,134,83,0.4)',
            paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3,
          }}>
            <Ionicons name="checkmark-circle" size={10} color="#2D8653" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 9, color: '#2D8653' }}>Verified</Text>
          </View>
        )}

        {/* Vendor logo */}
        {reel.vendor_logo_url && (
          <View style={{ position: 'absolute', bottom: -16, left: 10 }}>
            <Image source={{ uri: reel.vendor_logo_url }} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderColor: '#1A1208' }} resizeMode="cover" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 10, paddingTop: reel.vendor_logo_url ? 22 : 10, gap: 4 }}>
        {reel.caption && (
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }} numberOfLines={2}>
            {reel.caption}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={cfg.icon} size={10} color={cfg.color} />
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570' }} numberOfLines={1}>
            {reel.vendor_shop_name ?? 'Vendor'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="star" size={10} color="#F5A623" />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#FDF6EC' }}>
              {reel.vendor_rating && reel.vendor_rating > 0 ? reel.vendor_rating.toFixed(1) : 'New'}
            </Text>
          </View>
          {reel.distance != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="navigate-outline" size={10} color="#6B5E50" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>{formatDistance(reel.distance)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
