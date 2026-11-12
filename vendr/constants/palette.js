// Vendr design tokens — single source of truth for light and dark themes.
// Used by tailwind.config.js (via CSS variables) and constants/theme.ts (inline styles).
// Text tokens pass WCAG AA (4.5:1) on `canvas` and `surface` in both themes.

const light = {
  // Surfaces
  canvas: '#F7F7F5',     // screen background
  surface: '#FFFFFF',    // cards, inputs, sheets, tab bar
  surface2: '#F5F5F4',   // nested blocks, chips, skeletons
  line: '#E7E5E4',       // borders, dividers
  lineStrong: '#D6D3D1', // input borders, disabled fills
  glass: 'rgba(255,255,255,0.96)', // floating panels over maps
  heroBg: '#1C1917',     // wallet balance card

  // Text
  ink: '#1C1917',
  ink2: '#57534E',
  ink3: '#78716C',
  ink4: '#A8A29E',       // placeholders / disabled only
  onPrimary: '#FFFFFF',

  // Brand
  primary: '#E8521A',
  primaryPressed: '#C2410C',
  primaryInk: '#C2410C', // orange text
  primarySoft: '#FFF1EA',
  primaryBorder: '#FCD2BE',

  gold: '#F5A623',
  goldInk: '#B45309',
  goldSoft: '#FEF5E5',

  // Feedback
  success: '#2D8653',
  successInk: '#2D8653',
  successSoft: '#EAF5EE',
  danger: '#DC2626',
  dangerInk: '#DC2626',
  dangerSoft: '#FDECEC',
  info: '#2563EB',
  infoInk: '#2563EB',
  infoSoft: '#EBF2FE',

  overlay: 'rgba(12, 10, 9, 0.55)',
};

const dark = {
  canvas: '#0C0A09',
  surface: '#1C1917',
  surface2: '#292524',
  line: '#2F2A27',
  lineStrong: '#44403C',
  glass: 'rgba(28,25,23,0.96)',
  heroBg: '#292524',

  ink: '#FAFAF9',
  ink2: '#D6D3D1',
  ink3: '#A8A29E',
  ink4: '#78716C',
  onPrimary: '#FFFFFF',

  primary: '#E8521A',
  primaryPressed: '#C2410C',
  primaryInk: '#FB923C',
  primarySoft: '#3B1E10',
  primaryBorder: '#7C2D12',

  gold: '#F5A623',
  goldInk: '#FBBF24',
  goldSoft: '#3A2A0E',

  success: '#2D8653',
  successInk: '#4ADE80',
  successSoft: '#12301F',
  danger: '#DC2626',
  dangerInk: '#F87171',
  dangerSoft: '#3B1414',
  info: '#2563EB',
  infoInk: '#60A5FA',
  infoSoft: '#172554',

  overlay: 'rgba(0, 0, 0, 0.65)',
};

// Tokens exposed to Tailwind as CSS variables (must be solid hex colors)
const CSS_VAR_TOKENS = [
  'canvas', 'surface', 'surface2', 'line', 'lineStrong',
  'ink', 'ink2', 'ink3', 'ink4',
  'primaryInk', 'primarySoft', 'goldInk', 'goldSoft',
  'successInk', 'successSoft', 'dangerInk', 'dangerSoft', 'infoInk', 'infoSoft',
];

const toTriplet = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

// { '--c-canvas': '247 247 245', ... }
const cssVars = (theme) =>
  Object.fromEntries(CSS_VAR_TOKENS.map((k) => [`--c-${k}`, toTriplet(theme[k])]));

module.exports = { light, dark, palette: light, CSS_VAR_TOKENS, cssVars };
