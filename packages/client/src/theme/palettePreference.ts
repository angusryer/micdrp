/**
 * Persistence for the user's selected theme palette.
 *
 * Single seam for the `settings:themePalette` MMKV key. The palette itself is
 * owned by {@link ThemeProvider} (so changing it recolors the live tree); this
 * module only loads and saves the persisted choice, defaulting to ETheme.Blue
 * and treating any unrecognised stored value as the default.
 */
import { ETheme } from '../configs/theme';
import { getString, setString } from '../data/store';

/** MMKV key for the persisted palette — keep stable; changing it orphans data. */
export const KEY_THEME_PALETTE = 'settings:themePalette';

/** The persisted palette, or ETheme.Blue when absent/unrecognised. */
export function loadPalette(): ETheme {
  const raw = getString(KEY_THEME_PALETTE);
  if (raw === ETheme.Red || raw === ETheme.Green || raw === ETheme.Blue) {
    return raw;
  }
  return ETheme.Blue;
}

/** Persist the selected palette. */
export function savePalette(palette: ETheme): void {
  setString(KEY_THEME_PALETTE, palette);
}
