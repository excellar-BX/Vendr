import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface VerifiedBadgeProps {
  isVerified: boolean;
  verificationTier?: 'basic' | 'premium';
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export function VerifiedBadge({ 
  isVerified, 
  verificationTier = 'basic',
  size = 'small',
  showText = true 
}: VerifiedBadgeProps) {
  if (!isVerified) return null;

  const sizeConfig = {
    small: { iconSize: 12, fontSize: 11, padding: 4 },
    medium: { iconSize: 14, fontSize: 12, padding: 6 },
    large: { iconSize: 16, fontSize: 14, padding: 8 },
  };

  const config = sizeConfig[size];

  const tierConfig: Record<string, { color: string; icon: IoniconsName; label: string }> = {
    basic: { color: '#2D8653', icon: 'checkmark-circle', label: 'Verified' },
    premium: { color: '#F5A623', icon: 'diamond', label: 'Premium' },
  };

  const tier = tierConfig[verificationTier] || tierConfig.basic;

  return (
    <View 
      className="flex-row items-center gap-1 rounded-full border"
      style={{
        backgroundColor: `${tier.color}20`,
        borderColor: `${tier.color}40`,
        paddingHorizontal: config.padding + 4,
        paddingVertical: config.padding,
      }}
    >
      <Ionicons name={tier.icon} size={config.iconSize} color={tier.color} />
      {showText && (
        <Text 
          style={{ 
            color: tier.color, 
            fontFamily: 'SpaceGrotesk_600SemiBold', 
            fontSize: config.fontSize 
          }}
        >
          {tier.label}
        </Text>
      )}
    </View>
  );
}
