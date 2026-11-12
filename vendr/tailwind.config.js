const { light } = require('./constants/palette');

// Theme-aware colors resolve through CSS variables set at the app root
// (see app/_layout.tsx and constants/theme.ts), so `bg-surface` etc. switch
// automatically between light and dark mode.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        light: ['PlusJakartaSans_300Light'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        extrabold: ['PlusJakartaSans_800ExtraBold'],
      },
      colors: {
        canvas: v('canvas'),
        surface: { DEFAULT: v('surface'), 2: v('surface2') },
        line: { DEFAULT: v('line'), strong: v('lineStrong') },
        ink: { DEFAULT: v('ink'), 2: v('ink2'), 3: v('ink3'), 4: v('ink4') },
        orange: { DEFAULT: light.primary, light: '#FF6B35', ink: v('primaryInk'), soft: v('primarySoft') },
        gold: { DEFAULT: light.gold, ink: v('goldInk'), soft: v('goldSoft') },
        success: { DEFAULT: light.success, ink: v('successInk'), soft: v('successSoft') },
        danger: { DEFAULT: light.danger, ink: v('dangerInk'), soft: v('dangerSoft') },
        info: { DEFAULT: light.info, ink: v('infoInk'), soft: v('infoSoft') },
        brand: { green: light.success, greenLight: '#16A34A', red: light.danger },
      },
    },
  },
  plugins: [],
};
