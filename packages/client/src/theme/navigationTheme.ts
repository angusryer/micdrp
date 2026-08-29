/**
 * The palette, as React Navigation understands it.
 *
 * The tab navigator styled its own header and the stacks did not, so every
 * screen pushed on top of the tabs — a note's detail, its analysis, the
 * feedback queue — came up with React Navigation's own light header over a
 * dark app. Styling each one would be the same fact written down five times
 * and forgotten on the sixth.
 *
 * So the container is themed once and every navigator under it inherits.
 * `card` is what a header and a tab bar are drawn in; `background` is what
 * sits behind a screen while it is still arriving.
 */
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { IThemePalette } from '../types/theme';

export function navigationTheme(
  colors: IThemePalette['colors'],
  scheme: 'light' | 'dark'
): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: colors.primary500,
      background: colors.neutral300,
      card: colors.neutral300,
      text: colors.typography,
      border: colors.neutral500,
      notification: colors.error
    }
  };
}
