/**
 * Unit tests for useSettings (WP-SETTINGS-UI).
 *
 * Exercises the full round-trip through the mocked MMKV store wired by
 * jest.setup.js.  The real `data/store` module is used (it already talks to
 * the in-memory mock MMKV), so these tests validate:
 *   - Initial state equals DEFAULT_ENGINE_CONFIG.
 *   - Partial overrides are merged and persisted.
 *   - A second call to setEngineConfig accumulates on the previous override.
 *   - resetEngineConfig() returns all values to defaults and clears the store key.
 *   - Loading a fresh hook instance picks up previously persisted overrides
 *     (simulating an app restart).
 *
 * The theme palette is owned by the ThemeProvider now, so its persistence is
 * covered by theme/__tests__/ThemeProvider.test.tsx, not here.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { DEFAULT_ENGINE_CONFIG } from '../../../audio/contract';
import store from '../../../data/store';
import { useSettings, type UseSettingsValue } from '../useSettings';

// ---------------------------------------------------------------------------
// Store isolation
// ---------------------------------------------------------------------------

// Clear the store before every test so tests don't bleed into each other.
beforeEach(() => {
  store.clearAll();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function Harness({ onReady }: { onReady: (v: UseSettingsValue) => void }): null {
  onReady(useSettings());
  return null;
}

interface Mounted {
  api: () => UseSettingsValue;
  unmount: () => void;
}

function mount(): Mounted {
  let latest: UseSettingsValue | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  void act(() => {
    tree = TestRenderer.create(
      React.createElement(Harness, {
        onReady: (v: UseSettingsValue) => {
          latest = v;
        }
      })
    );
  });
  return {
    api: () => {
      if (latest === null) {
        throw new Error('Harness did not render before api() was called');
      }
      return latest;
    },
    unmount: () => tree.unmount()
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSettings', () => {
  describe('initial state', () => {
    it('returns DEFAULT_ENGINE_CONFIG when nothing is persisted', () => {
      const { api } = mount();
      expect(api().engineConfig).toEqual(DEFAULT_ENGINE_CONFIG);
    });
  });

  describe('setEngineConfig', () => {
    it('applies a partial override and merges with defaults', () => {
      const { api } = mount();

      void act(() => {
        api().setEngineConfig({ frameSize: 4096 });
      });

      expect(api().engineConfig).toEqual({
        ...DEFAULT_ENGINE_CONFIG,
        frameSize: 4096
      });
    });

    it('accumulates successive partial overrides', () => {
      const { api } = mount();

      void act(() => {
        api().setEngineConfig({ frameSize: 4096 });
      });
      void act(() => {
        api().setEngineConfig({ hopSize: 512 });
      });

      expect(api().engineConfig).toEqual({
        ...DEFAULT_ENGINE_CONFIG,
        frameSize: 4096,
        hopSize: 512
      });
    });

    it('overwrites the same field on repeated calls', () => {
      const { api } = mount();

      void act(() => {
        api().setEngineConfig({ clarityThreshold: 0.7 });
      });
      void act(() => {
        api().setEngineConfig({ clarityThreshold: 0.5 });
      });

      expect(api().engineConfig.clarityThreshold).toBeCloseTo(0.5);
    });

    it('persists the override so a fresh hook instance reads it back', () => {
      const { unmount, api } = mount();
      void act(() => {
        api().setEngineConfig({ emitRateHz: 30, minFrequencyHz: 80 });
      });
      unmount();

      // Simulate app restart: create a new hook instance backed by the same store.
      const { api: api2 } = mount();
      expect(api2().engineConfig.emitRateHz).toBe(30);
      expect(api2().engineConfig.minFrequencyHz).toBe(80);
      // Un-touched fields remain at their defaults.
      expect(api2().engineConfig.sampleRateHz).toBe(DEFAULT_ENGINE_CONFIG.sampleRateHz);
    });
  });

  describe('resetEngineConfig', () => {
    it('resets all fields to DEFAULT_ENGINE_CONFIG', () => {
      const { api } = mount();

      void act(() => {
        api().setEngineConfig({ frameSize: 4096, hopSize: 512 });
      });
      void act(() => {
        api().resetEngineConfig();
      });

      expect(api().engineConfig).toEqual(DEFAULT_ENGINE_CONFIG);
    });

    it('clears the persisted key so the next mount also sees defaults', () => {
      const { unmount, api } = mount();
      void act(() => {
        api().setEngineConfig({ frameSize: 4096 });
      });
      void act(() => {
        api().resetEngineConfig();
      });
      unmount();

      const { api: api2 } = mount();
      expect(api2().engineConfig).toEqual(DEFAULT_ENGINE_CONFIG);
    });
  });

  describe('loading persisted state on mount', () => {
    it('falls back to defaults for a corrupt JSON engine config', () => {
      // Write invalid JSON directly to the store key.
      store.setString('settings:engineConfig', '{not valid json}');

      const { api } = mount();
      expect(api().engineConfig).toEqual(DEFAULT_ENGINE_CONFIG);
    });
  });
});
