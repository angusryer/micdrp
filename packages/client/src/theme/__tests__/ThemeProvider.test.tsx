/**
 * Unit tests for ThemeProvider's palette ownership.
 *
 * ThemeProvider is the single owner of the active palette: `setPalette` must
 * recolor the live tree (no remount) and persist the choice so the next mount
 * restores it. The real `data/store` (in-memory mock MMKV via jest.setup.js) is
 * used, so these exercise the full persistence round-trip.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { ETheme } from '../../configs/theme';
import store from '../../data/store';
import { KEY_THEME_PALETTE } from '../palettePreference';
import { ThemeProvider, useTheme, type ThemeValue } from '../ThemeProvider';

beforeEach(() => {
  store.clearAll();
});

function Probe({ onReady }: { onReady: (v: ThemeValue) => void }): null {
  onReady(useTheme());
  return null;
}

interface Mounted {
  api: () => ThemeValue;
  unmount: () => void;
}

function mount(): Mounted {
  let latest: ThemeValue | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  void act(() => {
    tree = TestRenderer.create(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(Probe, {
          onReady: (v: ThemeValue) => {
            latest = v;
          }
        })
      )
    );
  });
  return {
    api: () => {
      if (latest === null) {
        throw new Error('ThemeProvider did not render before api() was called');
      }
      return latest;
    },
    unmount: () => tree.unmount()
  };
}

describe('ThemeProvider palette', () => {
  it('defaults to ETheme.Blue when nothing is persisted', () => {
    const { api } = mount();
    expect(api().palette).toBe(ETheme.Blue);
  });

  it('setPalette recolors the live tree without a remount', () => {
    const { api } = mount();
    const before = api().colors;

    void act(() => {
      api().setPalette(ETheme.Red);
    });

    expect(api().palette).toBe(ETheme.Red);
    // The same provider instance now exposes a different colour set.
    expect(api().colors).not.toEqual(before);
  });

  it('persists the palette so a fresh mount restores it', () => {
    const { unmount, api } = mount();
    void act(() => {
      api().setPalette(ETheme.Green);
    });
    unmount();

    const { api: api2 } = mount();
    expect(api2().palette).toBe(ETheme.Green);
  });

  it('restores every supported palette written by a previous session', () => {
    for (const palette of [ETheme.Blue, ETheme.Red, ETheme.Green]) {
      store.clearAll();
      store.setString(KEY_THEME_PALETTE, palette);
      const { api } = mount();
      expect(api().palette).toBe(palette);
    }
  });

  it('falls back to Blue for an unrecognised persisted value', () => {
    store.setString(KEY_THEME_PALETTE, 'Purple');
    const { api } = mount();
    expect(api().palette).toBe(ETheme.Blue);
  });

  it('honours an explicit initialPalette override', () => {
    let latest: ThemeValue | null = null;
    void act(() => {
      TestRenderer.create(
        React.createElement(
          ThemeProvider,
          { initialPalette: ETheme.Green },
          React.createElement(Probe, {
            onReady: (v: ThemeValue) => {
              latest = v;
            }
          })
        )
      );
    });
    expect(latest).not.toBeNull();
    expect((latest as unknown as ThemeValue).palette).toBe(ETheme.Green);
  });
});
