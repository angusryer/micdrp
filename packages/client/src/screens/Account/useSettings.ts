/**
 * useSettings — persisted EngineConfig overrides.
 *
 * Reads from and writes to the shared MMKV store via `data/store`. The live
 * config is `DEFAULT_ENGINE_CONFIG` merged with whatever overrides the user
 * has saved. On first launch (nothing persisted) all values equal the
 * defaults, so the engine always has sane numbers.
 *
 * The theme palette is NOT owned here — it lives in the ThemeProvider
 * (`useTheme().palette` / `setPalette`) so a change recolors the live tree. This
 * hook is the single write-seam for engine settings; nothing else writes the
 * engine-config key.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-SETTINGS-UI).
 */
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../../audio/contract';
import {
  applyEngineConfig,
  KEY_ENGINE_CONFIG,
  resolvedEngineConfig,
  storedOverrides,
  type EngineConfigOverrides
} from '../../audio/engineSettings';
import store from '../../data/store';

export type { EngineConfigOverrides };

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
}

// The resolver lives beside the engine, not here: the launch path needs it
// too and has no component to hang a hook on (INV-ACCOUNT-015).
const loadEngineConfig = resolvedEngineConfig;

export function useSettings(): UseSettingsValue {
  const [engineConfig, setEngineConfigState] = useState<EngineConfig>(loadEngineConfig);

  // Sync from store on mount in case another component has written since last
  // render (though in practice settings is the only writer).
  useEffect(() => {
    setEngineConfigState(loadEngineConfig());
  }, []);

  const setEngineConfig = useCallback((overrides: EngineConfigOverrides): void => {
    setEngineConfigState((_prev) => {
      // Read the already-persisted overrides so we accumulate deltas, then
      // merge the new partial on top.
      const existing = storedOverrides();
      const next: EngineConfigOverrides = { ...existing, ...overrides };
      store.setJSON(KEY_ENGINE_CONFIG, next);
      // Stored is not applied. Without this the control moves, the number
      // sticks, and the engine goes on using what it was compiled with.
      void applyEngineConfig();
      return { ...DEFAULT_ENGINE_CONFIG, ...next };
    });
  }, []);

  const resetEngineConfig = useCallback((): void => {
    store.remove(KEY_ENGINE_CONFIG);
    void applyEngineConfig();
    setEngineConfigState({ ...DEFAULT_ENGINE_CONFIG });
  }, []);

  return {
    engineConfig,
    setEngineConfig,
    resetEngineConfig
  };
}

export default useSettings;
