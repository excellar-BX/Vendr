import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';
import { Colors, Fonts } from '../../constants/colors';
import { T, useTheme } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: IoniconsName;
  iconRight?: IoniconsName;
  fullWidth?: boolean;
}

// Built per render so colors follow the live light/dark theme.
const getVariantStyles = (): Record<ButtonVariant, {
  bg: string;
  border?: string;
  fg: string;
  fontFamily: string;
  shadow?: object;
}> => ({
  primary: {
    bg: Colors.primary,
    fg: Colors.onPrimary,
    fontFamily: Fonts.bold,
    shadow: {
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 3,
    },
  },
  secondary: { bg: Colors.surface, border: Colors.lineStrong, fg: Colors.ink, fontFamily: Fonts.semibold },
  soft:      { bg: Colors.primarySoft, fg: Colors.primaryInk, fontFamily: Fonts.semibold },
  outline:   { bg: 'transparent', border: Colors.primary, fg: Colors.primaryInk, fontFamily: Fonts.semibold },
  ghost:     { bg: 'transparent', fg: Colors.primaryInk, fontFamily: Fonts.semibold },
  danger:    { bg: Colors.danger, fg: Colors.onPrimary, fontFamily: Fonts.bold },
});

const sizeStyles: Record<ButtonSize, { height: number; px: number; radius: number; fontSize: number; iconSize: number }> = {
  sm: { height: 40, px: 16, radius: 12, fontSize: 14, iconSize: 16 },
  md: { height: 48, px: 20, radius: 14, fontSize: 15, iconSize: 18 },
  lg: { height: 54, px: 24, radius: 14, fontSize: 16, iconSize: 20 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = true,
}: ButtonProps) {
  useTheme();
  const v = getVariantStyles()[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: s.radius,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : 1,
        },
        !isDisabled && v.shadow,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {iconLeft && <Ionicons name={iconLeft} size={s.iconSize} color={v.fg} />}
          <Text style={{ color: v.fg, fontSize: s.fontSize, fontFamily: v.fontFamily }}>
            {label}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={s.iconSize} color={v.fg} />}
        </>
      )}
    </TouchableOpacity>
  );
}
