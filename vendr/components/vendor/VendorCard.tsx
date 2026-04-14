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

interface VendorCardProps {
  vendor: Vendor;
}

export function VendorCard({ vendor }: VendorCardProps) {
  const config = categoryConfig[vendor.category] ?? { color: '#E8521A', icon: 'storefront-outline' };

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.88}
      className="bg-dark-2 rounded-3xl overflow-hidden border border-faint mb-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      {/* Banner */}
      <View className="h-36 bg-dark-3 items-center justify-center relative">
        {vendor.banner_url ? (
          <Image
            source={{ uri: vendor.banner_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center"
            style={{ backgroundColor: `${config.color}22` }}
          >
            <Ionicons name={config.icon} size={32} color={config.color} />
          </View>
        )}

        {/* Category badge */}
        <View
          style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: config.color, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name={config.icon} size={11} color="white" />
          <Text style={{ color: 'white', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11 }}>
            {vendor.category}
          </Text>
        </View>

        {/* Verified badge */}
        {vendor.user?.is_vendor_verified && (
          <View className="absolute top-3 right-3 bg-brand-green/60 border border-brand-green/40 px-2 py-1 rounded-full flex-row items-center gap-1">
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text className="text-xs text-white" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Verified
            </Text>
          </View>
        )}

        {/* Logo overlaid bottom-left */}
        {vendor.logo_url && (
          <View style={{ position: 'absolute', bottom: -18, left: 16 }}>
            <Image
              source={{ uri: vendor.logo_url }}
              style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#1A1208' }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ paddingHorizontal: 16, paddingTop: vendor.logo_url ? 24 : 12, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-cream text-base flex-1 mr-2"
            style={{ fontFamily: 'SpaceGrotesk_700Bold' }}
            numberOfLines={1}
          >
            {vendor.shop_name}
          </Text>

          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={13} color="#F5A623" />
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
            </Text>
            {vendor.review_count > 0 && (
              <Text className="text-muted text-xs">({vendor.review_count})</Text>
            )}
          </View>
        </View>

        {vendor.description && (
          <Text className="text-muted text-sm mb-2" numberOfLines={1}>
            {vendor.description}
          </Text>
        )}

        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color="#9A8570" />
            <Text className="text-muted text-xs">
              {vendor.distance != null ? formatDistance(vendor.distance) : vendor.address ?? 'Nearby'}
            </Text>
          </View>

          <View className={`w-2 h-2 rounded-full ${vendor.is_active ? 'bg-brand-green' : 'bg-subtle'}`} />
        </View>
      </View>
    </TouchableOpacity>
  );
}