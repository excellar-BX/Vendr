import { View, TouchableOpacity, Image, ImageBackground } from 'react-native';
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

interface HeroVendorCardProps {
  vendor: Vendor;
}

export function HeroVendorCard({ vendor }: HeroVendorCardProps) {
  const config = categoryConfig[vendor.category] ?? { color: '#E8521A', icon: 'storefront-outline' };

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.9}
      style={{
        height: 220,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#2A1F14',
      }}
    >
      {/* Background banner */}
      {vendor.banner_url ? (
        <ImageBackground
          source={{ uri: vendor.banner_url }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {/* Gradient overlay */}
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(15,10,6,0.55)',
              padding: 20,
              justifyContent: 'space-between',
            }}
          >
            <HeroContent vendor={vendor} config={config} />
          </View>
        </ImageBackground>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: '#1A1208',
            padding: 20,
            justifyContent: 'space-between',
          }}
        >
          {/* Decorative glow */}
          <View
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: config.color,
              opacity: 0.07,
              top: -60,
              right: -60,
            }}
          />
          <HeroContent vendor={vendor} config={config} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function HeroContent({
  vendor,
  config,
}: {
  vendor: Vendor;
  config: { color: string; icon: IoniconsName };
}) {
  return (
    <>
      {/* Top row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Category + Verified */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: config.color,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
            }}
          >
            <Ionicons name={config.icon} size={11} color="white" />
            <Text style={{ color: 'white', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11 }}>
              {vendor.category}
            </Text>
          </View>

          {vendor.user?.is_vendor_verified && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(45,134,83,0.5)',
                borderWidth: 1,
                borderColor: 'rgba(45,134,83,0.4)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 20,
              }}
            >
              <Ionicons name="shield-checkmark" size={11} color="#fff" />
              <Text style={{ color: 'white', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11 }}>
                Verified
              </Text>
            </View>
          )}
        </View>

        {/* Active indicator */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(15,10,6,0.6)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#2A1F14',
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: vendor.is_active ? '#2D8653' : '#6B5E50',
            }}
          />
          <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11 }}>
            {vendor.is_active ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      {/* Bottom row */}
      <View>
        {/* Logo + Name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {vendor.logo_url ? (
            <Image
              source={{ uri: vendor.logo_url }}
              style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: '#2A1F14' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: `${config.color}33`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 }}
              numberOfLines={1}
            >
              {vendor.shop_name}
            </Text>
            {vendor.description ? (
              <Text
                style={{ color: 'rgba(253,246,236,0.6)', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12 }}
                numberOfLines={1}
              >
                {vendor.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={13} color="#F5A623" />
            <Text style={{ color: '#FDF6EC', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 }}>
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
            </Text>
            {vendor.review_count > 0 && (
              <Text style={{ color: 'rgba(253,246,236,0.5)', fontSize: 12 }}>
                ({vendor.review_count})
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location-outline" size={13} color="rgba(253,246,236,0.5)" />
            <Text style={{ color: 'rgba(253,246,236,0.6)', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12 }}>
              {vendor.distance != null ? formatDistance(vendor.distance) : vendor.address ?? 'Nearby'}
            </Text>
          </View>

          {/* Tap cue */}
          <View style={{ marginLeft: 'auto' }}>
            <View
              style={{
                backgroundColor: '#E8521A',
                width: 32,
                height: 32,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-forward" size={16} color="white" />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}