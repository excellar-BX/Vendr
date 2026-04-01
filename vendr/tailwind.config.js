module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['SpaceGrotesk_400Regular'],
        light: ['SpaceGrotesk_300Light'],
        medium: ['SpaceGrotesk_500Medium'],
        semibold: ['SpaceGrotesk_600SemiBold'],
        bold: ['SpaceGrotesk_700Bold'],
      },
      colors: {
        orange: { DEFAULT: '#E8521A', light: '#FF6B35' },
        gold: '#F5A623',
        dark: { DEFAULT: '#0F0A06', 2: '#1A1208', 3: '#231A0E', 4: '#2E2214' },
        cream: { DEFAULT: '#FDF6EC', 2: '#F5ECD8' },
        muted: '#9A8570',
        subtle: '#6B5E50',
        faint: '#3D3026',
        brand: { green: '#2D8653', greenLight: '#4CAF50', red: '#E85555' },
      },
    },
  },
  plugins: [],
};