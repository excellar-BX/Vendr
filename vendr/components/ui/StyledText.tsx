import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { T, useTheme } from '../../constants/theme';

type FontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

interface StyledTextProps extends TextProps {
  weight?: FontWeight;
}

const weightMap: Record<FontWeight, string> = {
  light:    'PlusJakartaSans_300Light',
  regular:  'PlusJakartaSans_400Regular',
  medium:   'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold:     'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

const fontWeightMap: Record<string, string> = {
  '300': 'PlusJakartaSans_300Light',
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
  normal: 'PlusJakartaSans_400Regular',
  bold:   'PlusJakartaSans_700Bold',
};

export function Text({ style, weight, ...props }: StyledTextProps) {
  useTheme();
  const fontScale = useAuthStore(s => s.fontScale);
  const flat = StyleSheet.flatten(style);
  const fromWeight = flat?.fontWeight ? fontWeightMap[flat.fontWeight.toString()] : null;
  const fontFamily = weight
    ? weightMap[weight]
    : fromWeight ?? 'PlusJakartaSans_400Regular';

  // Scale fontSize if explicitly set, otherwise let it inherit naturally
  const baseFontSize = flat?.fontSize;
  const scaledFontSize = baseFontSize ? baseFontSize * fontScale : undefined;

  // Default to theme ink only when neither style nor className sets a color
  // (inline styles override className in NativeWind, so never force it).
  const cls = (props as any).className as string | undefined;
  const hasClassColor = !!cls && /(^|s)text-(?!(xs|sm|base|lg|xl|[2-9]xl|center|left|right|justify)(s|$))[a-z]/.test(cls);
  const defaultColor = flat?.color || hasClassColor ? null : { color: T.ink };

  return (
    <RNText
      style={[{ fontFamily }, defaultColor, style, scaledFontSize ? { fontSize: scaledFontSize } : {}]}
      {...props}
    />
  );
}