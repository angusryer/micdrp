/**
 * The hook, and what happens with no engine underneath it.
 *
 * `react-native` is mocked WITHOUT an AudioEngineModule, which used to
 * select a second implementation of the detector written in TypeScript.
 * There is no second implementation now (INV-PITCH-029), so the same
 * condition has to produce a refusal that says why — the thing a fallback
 * is very good at hiding.
 *
 * The hook is exercised through a tiny harness component rendered with
 * `react-test-renderer` (a declared devDependency), avoiding any extra
 * hook-testing library.
 */


import { harnessElement } from '../../testing/harness';
import TestRenderer, { act } from 'react-test-renderer';

// ---- react-native mock WITHOUT the native audio module ----
// The spec module resolves to null when the binary carries no such module.
jest.mock('../../specs/NativeAudioEngine', () => ({
  __esModule: true,
  default: null
}));

import audioEngine from '../AudioEngine';
import { PitchSample } from '../contract';
import { useAudioEngine, UseAudioEngine } from '../useAudioEngine';

describe('with no engine in the build', () => {
  it('ACC-PITCH-023: refuses a capture, naming what is missing', async () => {
    // This used to quietly start a second detector written in TypeScript.
    // A capture that runs on something other than the engine is one whose
    // results nobody measured (INV-PITCH-029).
    expect(audioEngine.isNative).toBe(false);
    await expect(audioEngine.start()).rejects.toThrow(/native audio engine/i);
  });

  it('says the same of a permission it cannot ask for', async () => {
    await expect(audioEngine.requestPermission()).rejects.toThrow(
      /native audio engine/i
    );
  });

  it('stays quiet only for re-reading, where nothing is lost', async () => {
    // A re-read of something already captured can decline and leave the
    // note exactly as it was; a capture cannot (INV-NOTES-116).
    await expect(audioEngine.analyzeFile('file:///take.wav')).resolves.toEqual([]);
  });
});

// ---- hook harness ----

function HookHarness({ onReady }: { onReady: (api: UseAudioEngine) => void }): null {
  const api = useAudioEngine();
  onReady(api);
  return null;
}

describe('useAudioEngine hook', () => {
  it('exposes the engine API and tracks coarse state', () => {
    let api: UseAudioEngine | null = null;
    void act(() => {
      TestRenderer.create(
        harnessElement(HookHarness, { onReady: (a) => (api = a) })
      );
    });
    expect(api).not.toBeNull();
    const ready = api as unknown as UseAudioEngine;
    expect(ready.state).toBe('idle');
    expect(typeof ready.start).toBe('function');
    expect(typeof ready.stop).toBe('function');
    expect(typeof ready.configure).toBe('function');
    expect(typeof ready.requestPermission).toBe('function');
    expect(typeof ready.onPitch).toBe('function');
  });

  it('subscribes to pitch and auto-cleans up on unmount without throwing', () => {
    let api: UseAudioEngine | null = null;
    let tree: TestRenderer.ReactTestRenderer | null = null;
    void act(() => {
      tree = TestRenderer.create(
        harnessElement(HookHarness, { onReady: (a) => (api = a) })
      );
    });

    const received: PitchSample[] = [];
    void act(() => {
      (api as unknown as UseAudioEngine).onPitch((s) => received.push(s));
    });

    expect(() => act(() => (tree as unknown as TestRenderer.ReactTestRenderer).unmount())).not.toThrow();
  });

  it('returns an idempotent unsubscribe from onPitch', () => {
    let api: UseAudioEngine | null = null;
    void act(() => {
      TestRenderer.create(
        harnessElement(HookHarness, { onReady: (a) => (api = a) })
      );
    });
    let off: () => void = () => undefined;
    void act(() => {
      off = (api as unknown as UseAudioEngine).onPitch(() => undefined);
    });
    expect(() => {
      off();
      off();
    }).not.toThrow();
  });
});
