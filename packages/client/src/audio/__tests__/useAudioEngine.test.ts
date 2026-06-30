/**
 * Unit tests for the useAudioEngine hook AND the Tier-2 worklet fallback.
 *
 * Here `react-native` is mocked WITHOUT an AudioEngineModule, so the engine
 * singleton selects Tier 2 (the audio-api worklet path). We assert tier
 * selection, that the pure-`logic` frame analysis is wired correctly, and that
 * the hook subscribes/cleans up on unmount. No device required.
 *
 * The hook is exercised through a tiny harness component rendered with
 * `react-test-renderer` (a declared devDependency), avoiding any extra
 * hook-testing library.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// ---- react-native mock WITHOUT the native audio module (forces Tier 2) ----
jest.mock('react-native', () => {
  class NativeEventEmitter {
    addListener() {
      return { remove: () => undefined };
    }
  }
  return {
    NativeModules: {}, // no AudioEngineModule => Tier 2
    NativeEventEmitter
  };
});

import audioEngine from '../AudioEngine';
import { analyzeFrame } from '../worklet/pitchProcessor';
import { DEFAULT_ENGINE_CONFIG, EngineState, PitchSample } from '../contract';
import { useAudioEngine, UseAudioEngine } from '../useAudioEngine';

describe('AudioEngine (Tier 2 — native absent)', () => {
  it('falls back to the worklet tier when no native module is registered', () => {
    // @ts-expect-error test-only accessor
    expect(audioEngine.tier).toBe(2);
    // @ts-expect-error test-only accessor
    expect(audioEngine.isNative).toBe(false);
  });

  it('drives coarse state transitions through start/stop on the fallback', async () => {
    const states: EngineState[] = [];
    const off = audioEngine.onState((s) => states.push(s));
    await audioEngine.start();
    const handle = await audioEngine.stop();
    off();
    expect(states).toContain('recording');
    expect(states).toContain('idle');
    expect(handle.sampleRateHz).toBe(DEFAULT_ENGINE_CONFIG.sampleRateHz);
    expect(Array.isArray(handle.samples)).toBe(true);
  });
});

describe('analyzeFrame (Tier-2 logic wiring)', () => {
  function sine(freq: number, sampleRate: number, n: number): Float32Array {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    return out;
  }

  it('detects a clean 440Hz tone as MIDI 69 (A4)', () => {
    const sr = 44100;
    const frame = sine(440, sr, 2048);
    const sample = analyzeFrame(frame, sr, 100, DEFAULT_ENGINE_CONFIG);
    expect(sample.timestampMs).toBe(100);
    expect(sample.midi).toBe(69);
    expect(Math.abs(sample.frequencyHz - 440)).toBeLessThan(2);
    expect(sample.clarity).toBeGreaterThan(0.9);
  });

  it('reports an unvoiced frame (null midi/cents) for silence', () => {
    const sr = 44100;
    const frame = new Float32Array(2048); // all zeros
    const sample = analyzeFrame(frame, sr, 0, DEFAULT_ENGINE_CONFIG);
    expect(sample.midi).toBeNull();
    expect(sample.cents).toBeNull();
    expect(sample.frequencyHz).toBe(0);
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
        React.createElement(HookHarness, { onReady: (a) => (api = a) })
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
        React.createElement(HookHarness, { onReady: (a) => (api = a) })
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
        React.createElement(HookHarness, { onReady: (a) => (api = a) })
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
