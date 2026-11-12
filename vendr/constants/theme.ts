import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, cssVars, ThemeTokens } from './palette';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type LiveTheme = ThemeTokens & {
  scheme: Scheme;
  isDark: boolean;
  /** For expo-status-bar's `style` prop */
  statusBar: 'light' | 'dark';
  /** For react-native StatusBar's `barStyle` prop */
  barStyle: 'light-content' | 'dark-content';
};

const derive = (scheme: Scheme): LiveTheme => ({
  ...(scheme === 'dark' ? dark : light),
  scheme,
  isDark: scheme === 'dark',
  statusBar: scheme === 'dark' ? 'light' : 'dark',
  barStyle: scheme === 'dark' ? 'light-content' : 'dark-content',
});

/**
 * The live theme. Its values are swapped in place when the scheme changes,
 * so `T.ink` always reads the current theme. Components must call
 * `useTheme()` so they re-render when it changes.
 */
export const T: LiveTheme = derive('light');

export const THEME_VARS = { light: cssVars(light), dark: cssVars(dark) };

interface ThemeState {
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
  applyScheme: (scheme: Scheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      scheme: 'light',
      setMode: (mode) => set({ mode }),
      applyScheme: (scheme) => {
        if (get().scheme === scheme && T.scheme === scheme) return;
        // Mutate the live object BEFORE notifying subscribers so re-renders read new values.
        Object.assign(T, derive(scheme));
        set({ scheme });
      },
    }),
    {
      name: 'vendr-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
);

/** Subscribe the calling component to theme changes and return the live theme. */
export function useTheme(): LiveTheme {
  useThemeStore((s) => s.scheme);
  return T;
}
