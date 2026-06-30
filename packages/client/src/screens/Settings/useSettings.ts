/**
 * useSettings — persisted EngineConfig overrides + theme palette selection.
 *
 * Reads from and writes to the shared MMKV store via `data/store`. The live
 * config is `DEFAULT_ENGINE_CONFIG` merged with whatever overrides the user
 * has saved. On first launch (nothing persisted) all values equal the
 * defaults, so the engine always has sane numbers.
 *
 * Theme palette (`ETheme.Blue | Red | Green`) is stored separately under its
 * own key and surfaced as `themePalette` / `setThemePalette`.
 *
 * This hook is the single write-seam for settings: every control in
 * `SettingsScreen` calls into it, and nothing else writes these keys.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-SETTINGS-UI).
 */
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../../audio/contract';
import { ETheme } from '../../configs/theme';
import store from '../../data/store';

/** MMKV keys — keep stable; changing them orphans existing persisted data. */
const KEY_ENGINE_CONFIG = 'settings:engineConfig';
const KEY_THEME_PALETTE = 'settings:themePalette';

/** All overrides are optional; any key absent means "use the default". */
export type EngineConfigOverrides = Partial<EngineConfig>;

export interface UseSettingsValue {
  /**
   * The resolved engine config: `DEFAULT_ENGINE_CONFIG` merged with the user's
   * persisted overrides. Always a complete `EngineConfig`.
   */
  engineConfig: EngineConfig;

  /**
   * Merge a partial override into the stored settings.  Fields not present in
   * `overrides` are left unchanged (i.e. this is a PATCH, not a PUT).
   */
  setEngineConfig(overrides: EngineConfigOverrides): void;

  /** Reset all engine settings back to `DEFAULT_ENGINE_CONFIG`. */
  resetEngineConfig(): void;

  /** The persisted theme palette, defaulting to `ETheme.Blue`. */
  themePalette: ETheme;

  /** Persist a new theme palette selection. */
  setThemePalette(palette: ETheme): void;
}

function loadEngineConfig(): EngineConfig {
  const overrides = store.getJSON<EngineConfigOverrides>(KEY_ENGINE_CONFIG);
  return { ...DEFAULT_ENGINE_CONFIG, ...(overrides ?? {}) };
}

function loadThemePalette(): ETheme {
  const raw = store.getString(KEY_THEME_PALETTE);
  if (raw === ETheme.Red || raw === ETheme.Green || raw === ETheme.Blue) {
    return raw;
  }
  return ETheme.Blue;
}

export function useSettings(): UseSettingsValue {
  const [engineConfig, setEngineConfigState] = useState<EngineConfig>(loadEngineConfig);
  const [themePalette, setThemePaletteState] = useState<ETheme>(loadThemePalette);

  // Sync from store on mount in case another component has written since last
  // render (though in practice settings is the only writer).
  useEffect(() => {
    setEngineConfigState(loadEngineConfig());
    setThemePaletteState(loadThemePalette());
  }, []);

  const setEngineConfig = useCallback((overrides: EngineConfigOverrides): void => {
    setEngineConfigState((_prev) => {
      // Read the already-persisted overrides so we accumulate deltas, then
      // merge the new partial on top.
      const existing = store.getJSON<EngineConfigOverrides>(KEY_ENGINE_CONFIG) ?? {};
      const next: EngineConfigOverrides = { ...existing, ...overrides };
      store.setJSON(KEY_ENGINE_CONFIG, next);
      return { ...DEFAULT_ENGINE_CONFIG, ...next };
    });
  }, []);

  const resetEngineConfig = useCallback((): void => {
    store.remove(KEY_ENGINE_CONFIG);
    setEngineConfigState({ ...DEFAULT_ENGINE_CONFIG });
  }, []);

  const setThemePalette = useCallback((palette: ETheme): void => {
    store.setString(KEY_THEME_PALETTE, palette);
    setThemePaletteState(palette);
  }, []);

  return {
    engineConfig,
    setEngineConfig,
    resetEngineConfig,
    themePalette,
    setThemePalette
  };
}

export default useSettings;
