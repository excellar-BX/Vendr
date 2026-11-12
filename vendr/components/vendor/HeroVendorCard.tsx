import { View, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from '../ui/StyledText';
import { Vendor } from '../../types';
import { formatDistance } from '../../lib/utils';
import { Colors, Fonts, Shadow } from '../../constants/colors';
import { T, useTheme } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const categoryConfig: Record<string, { color: string; icon: IoniconsName }> = {
  'Food & Drinks':  { color: '#E8521A', icon: 'fast-food-outline' },
  'Fashion':        { color: '#D97706', icon: 'shirt-outline' },
  'Accessories':    { color: '#78716C', icon: 'diamond-outline' },
  'Beauty & Hair':  { color: '#DB2777', icon: 'cut-outline' },
  'Electronics':    { color: '#2563EB', icon: 'phone-portrait-outline' },
  'Groceries':      { color: '#2D8653', icon: 'basket-outline' },
};

interface HeroVendorCardProps {
  vendor: Vendor;
}

export function HeroVendorCard({ vendor }: HeroVendorCardProps) {
  useTheme();
  const config = categoryConfig[vendor.category] ?? { color: Colors.primary, icon: 'storefront-outline' as IoniconsName };

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Featured vendor ${vendor.shop_name}`}
      style={{
        height: 220,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 28,
        backgroundColor: Colors.surface,
        borderWidth: vendor.banner_url ? 0 : 1,
        borderColor: Colors.line,
        ...Shadow.card,
      }}
    >
      {vendor.banner_url ? (
        <ImageBackground source={{ uri: vendor.banner_url }} style={{ flex: 1 }} resizeMode="cover">
          {/* Scrim so white text is always readable over photos */}
          <View style={{ flex: 1, backgroundColor: 'rgba(12,10,9,0.45)', padding: 18, justifyContent: 'space-between' }}>
            <HeroContent vendor={vendor} config={config} onImage />
          </View>
        </ImageBackground>
      ) : (
        <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
          <View
            style={{
              position: 'absolute', width: 220, height: 220, borderRadius: 110,
              backgroundColor: config.color, opacity: 0.08, top: -70, right: -70,
            }}
          />
          <HeroContent vendor={vendor} config={config} onImage={false} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function HeroContent({
  vendor,
  config,
  onImage,
}: {
  vendor: Vendor;
  config: { color: string; icon: IoniconsName };
  onImage: boolean;
}) {
  useTheme();
  const ink = onImage ? '#FFFFFF' : Colors.ink;
  const ink2 = onImage ? 'rgba(255,255,255,0.85)' : Colors.ink2;
  const pillBg = onImage ? 'rgba(12,10,9,0.55)' : Colors.surface2;

  return (
    <>
      {/* Top row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: config.color,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
            }}
          >
            <Ionicons name={config.icon} size={11} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontFamily: Fonts.semibold, fontSize: 11 }}>
              {vendor.category}
            </Text>
          </View>

          {vendor.user?.is_vendor_verified && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: Colors.success,
                paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
              }}
            >
              <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontFamily: Fonts.semibold, fontSize: 11 }}>Verified</Text>
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: pillBg,
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          }}
        >
          <View
            style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: vendor.is_active ? '#22C55E' : Colors.ink4,
            }}
          />
          <Text style={{ color: ink, fontFamily: Fonts.medium, fontSize: 11 }}>
            {vendor.is_active ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      {/* Bottom row */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {vendor.logo_url ? (
            <Image
              source={{ uri: vendor.logo_url }}
              style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: T.surface }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: `${config.color}22`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: ink, fontFamily: Fonts.extrabold, fontSize: 19, letterSpacing: -0.3 }} numberOfLines={1}>
              {vendor.shop_name}
            </Text>
            {vendor.description ? (
              <Text style={{ color: ink2, fontFamily: Fonts.regular, fontSize: 13 }} numberOfLines={1}>
                {vendor.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={13} color={Colors.gold} />
            <Text style={{ color: ink, fontFamily: Fonts.semibold, fontSize: 13 }}>
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New'}
            </Text>
            {vendor.review_count > 0 && (
              <Text style={{ color: ink2, fontSize: 12 }}>({vendor.review_count})</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
            <Ionicons name="location-outline" size={13} color={ink2} />
            <Text style={{ color: ink2, fontFamily: Fonts.regular, fontSize: 12 }} numberOfLines={1}>
              {vendor.distance != null ? formatDistance(vendor.distance) : vendor.address ?? 'Nearby'}
            </Text>
          </View>

          <View style={{ marginLeft: 'auto' }}>
            <View
              style={{
                backgroundColor: Colors.primary,
                width: 36, height: 36, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}
