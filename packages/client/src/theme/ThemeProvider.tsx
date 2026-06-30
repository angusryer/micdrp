import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';
import { useColorScheme } from 'react-native';
import {
  dimensions,
  effects,
  ETheme,
  palettes,
  typography
} from '../configs/theme';
import { loadPalette, savePalette } from './palettePreference';

type Scheme = 'light' | 'dark';
type Palette = (typeof palettes)['light'][ETheme.Blue];
export type ThemeColors = Palette['colors'];

export interface ThemeValue {
  scheme: Scheme;
  palette: ETheme;
  colors: ThemeColors;
  dimensions: typeof dimensions;
  typography: typeof typography;
  effects: typeof effects;
  /** Switch the active palette and persist it; recolors the live tree at once. */
  setPalette(palette: ETheme): void;
}

/**
 * Exported so resilient consumers (e.g. the top-level ErrorBoundary, which may
 * render after a provider has unmounted) can read the theme via `useContext`
 * with their own fallback instead of throwing through {@link useTheme}.
 */
export const ThemeContext = createContext<ThemeValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Optional initial palette (mainly for tests/storybook). When omitted the
   * provider restores the user's persisted choice, so a cold start already
   * shows the selected palette.
   */
  initialPalette?: ETheme;
}

/**
 * The single owner of the active palette. It holds the palette in state so that
 * `setPalette` recolors every consumer live (no cold start required), and it
 * persists the choice through {@link savePalette} so the next launch restores it.
 */
export function ThemeProvider({
  children,
  initialPalette
}: ThemeProviderProps): React.JSX.Element {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';
  const [palette, setPaletteState] = useState<ETheme>(
    () => initialPalette ?? loadPalette()
  );

  const setPalette = useCallback((next: ETheme): void => {
    savePalette(next);
    setPaletteState(next);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      palette,
      colors: palettes[scheme][palette].colors,
      dimensions,
      typography,
      effects,
      setPalette
    }),
    [scheme, palette, setPalette]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
