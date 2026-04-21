import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '../ui/StyledText';
import { Vendor } from '../../types';
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

interface VendorRowProps {
  vendor: Vendor;
  /** Width of the card — caller controls how wide each tile is */
  width?: number;
}

export function VendorRow({ vendor, width = 160 }: VendorRowProps) {
  const config = categoryConfig[vendor.category] ?? { color: '#E8521A', icon: 'storefront-outline' };

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.88}
      style={{
        width,
        backgroundColor: '#1A1208',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A1F14',
        marginRight: 12,
      }}
    >
      {/* Banner thumbnail */}
      <View style={{ height: 90, backgroundColor: '#0F0A06', position: 'relative' }}>
        {vendor.banner_url ? (
          <Image
            source={{ uri: vendor.banner_url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${config.color}11`,
            }}
          >
            <Ionicons name={config.icon} size={28} color={`${config.color}88`} />
          </View>
        )}

        {/* Active dot */}
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: vendor.is_active ? '#2D8653' : '#3A2E25',
            borderWidth: 1.5,
            borderColor: '#1A1208',
          }}
        />

        {/* Verified badge */}
        {vendor.user?.is_vendor_verified && (
          <View
            style={{
              position: 'absolute',
              bottom: 7,
              right: 7,
              backgroundColor: 'rgba(45,134,83,0.85)',
              borderRadius: 6,
              padding: 3,
            }}
          >
            <Ionicons name="shield-checkmark" size={11} color="#fff" />
          </View>
        )}

        {/* Logo overlapping bottom */}
        {vendor.logo_url && (
          <View style={{ position: 'absolute', bottom: -14, left: 10 }}>
            <Image
              source={{ uri: vendor.logo_url }}
              style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: '#1A1208' }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 10, paddingTop: vendor.logo_url ? 20 : 10 }}>
        <Text
          style={{
            color: '#FDF6EC',
            fontFamily: 'SpaceGrotesk_700Bold',
            fontSize: 13,
            marginBottom: 3,
          }}
          numberOfLines={1}
        >
          {vendor.shop_name}
        </Text>

        {/* Rating */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 }}>
          <Ionicons name="star" size={11} color="#F5A623" />
          <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11 }}>
            {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
          </Text>
          {vendor.review_count > 0 && (
            <Text style={{ color: '#6B5E50', fontSize: 11 }}>
              ·{vendor.review_count}
            </Text>
          )}
        </View>

        {/* Distance */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="location-outline" size={11} color="#6B5E50" />
          <Text style={{ color: '#9A8570', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11 }} numberOfLines={1}>
            {vendor.distance != null ? formatDistance(vendor.distance) : vendor.address ?? 'Nearby'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}