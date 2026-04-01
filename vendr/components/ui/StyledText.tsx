import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

type FontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';

interface StyledTextProps extends TextProps {
  weight?: FontWeight;
}

const weightMap: Record<FontWeight, string> = {
  light:    'SpaceGrotesk_300Light',
  regular:  'SpaceGrotesk_400Regular',
  medium:   'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold:     'SpaceGrotesk_700Bold',
};

const fontWeightMap: Record<string, string> = {
  '300': 'SpaceGrotesk_300Light',
  '400': 'SpaceGrotesk_400Regular',
  '500': 'SpaceGrotesk_500Medium',
  '600': 'SpaceGrotesk_600SemiBold',
  '700': 'SpaceGrotesk_700Bold',
  normal: 'SpaceGrotesk_400Regular',
  bold:   'SpaceGrotesk_700Bold',
};

export function Text({ style, weight, ...props }: StyledTextProps) {
  const fontScale = useAuthStore(s => s.fontScale);
  const flat = StyleSheet.flatten(style);
  const fromWeight = flat?.fontWeight ? fontWeightMap[flat.fontWeight.toString()] : null;
  const fontFamily = weight
    ? weightMap[weight]
    : fromWeight ?? 'SpaceGrotesk_400Regular';

  // Scale fontSize if explicitly set, otherwise let it inherit naturally
  const baseFontSize = flat?.fontSize;
  const scaledFontSize = baseFontSize ? baseFontSize * fontScale : undefined;

  return (
    <RNText
      style={[{ fontFamily }, style, scaledFontSize ? { fontSize: scaledFontSize } : {}]}
      {...props}
    />
  );
}