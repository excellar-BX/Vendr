import { T } from './theme';

export { T, useTheme, useThemeStore } from './theme';

/** Live theme tokens (same object as `T`). Values change with light/dark mode. */
export const Colors = T;

export const Fonts = {
  light: 'PlusJakartaSans_300Light',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Soft card elevation
export const Shadow = {
  card: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
};
