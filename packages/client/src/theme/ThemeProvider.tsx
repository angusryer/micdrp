import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  dimensions,
  effects,
  ETheme,
  palettes,
  typography
} from '../configs/theme';

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
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  palette?: ETheme;
}

export function ThemeProvider({
  children,
  palette = ETheme.Blue
}: ThemeProviderProps) {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      palette,
      colors: palettes[scheme][palette].colors,
      dimensions,
      typography,
      effects
    }),
    [scheme, palette]
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
