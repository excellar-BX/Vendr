/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        orange: {
          DEFAULT: '#E8521A',
          light: '#FF6B35',
          50: '#FDF0EA',
          100: '#FAD9C8',
          200: '#F5B49A',
          500: '#E8521A',
          600: '#CC4615',
          700: '#A33610',
        },
        gold: {
          DEFAULT: '#F5A623',
          50: '#FEF6E7',
          100: '#FDE7BB',
          500: '#F5A623',
          600: '#D48C0F',
        },
        dark: {
          DEFAULT: '#0F0A06',
          2: '#1A1208',
          3: '#231A0E',
          4: '#2E2214',
          5: '#3D2E1C',
        },
        cream: {
          DEFAULT: '#FDF6EC',
          2: '#F5ECD8',
        },
        muted: '#9A8570',
        subtle: '#6B5E50',
        faint: '#3D3026',
        brand: {
          green: '#2D8653',
          greenLight: '#4CAF50',
          red: '#E85555',
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}