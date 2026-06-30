/**
 * Unit tests for useRecordController — the engine ⇄ machine ⇄ shared-value
 * binding layer.
 *
 * The real `AudioEngine` singleton is replaced with a fully controllable fake
 * (via mocking `useAudioEngine`) so we can assert, with no device:
 *   • start() requests permission, sends START, and starts the engine;
 *   • entering `recording` subscribes to the live pitch stream exactly once;
 *   • each emitted PitchSample is written into the shared values (off React);
 *   • stop() detaches the subscription, stops the engine, and resolves the
 *     handle while the machine advances idle→recording→analyzing→result;
 *   • a denied permission rejects without subscribing.
 *
 * The hook is exercised through a tiny harness rendered with
 * `react-test-renderer` (a declared devDependency) — the same pattern as
 * useAudioEngine.test.ts — so no extra hook-testing library is required.
 * Reanimated is mocked by jest.setup.js, so `useSharedValue` returns a real
 * mutable `{ value }` we can read back.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type { PitchSample, RecordingHandle } from '../../../audio/contract';
import type { UseAudioEngine } from '../../../audio/useAudioEngine';

// ---- controllable fake engine ----
type PitchCb = (s: PitchSample) => void;

const handle: RecordingHandle = {
  id: 'rec-1',
  uri: 'file:///tmp/rec-1.wav',
  sampleRateHz: 44100,
  durationMs: 1000,
  samples: []
};

let pitchCb: PitchCb | null = null;
const unsubscribe = jest.fn(() => {
  pitchCb = null;
});

const engineMock: jest.Mocked<UseAudioEngine> & {
  __emit(s: PitchSample): void;
} = {
  state: 'idle',
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve(handle)),
  configure: jest.fn(() => Promise.resolve()),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  onPitch: jest.fn((cb: PitchCb) => {
    pitchCb = cb;
    return unsubscribe;
  }),
  __emit(s: PitchSample) {
    pitchCb?.(s);
  }
};

jest.mock('../../../audio/useAudioEngine', () => ({
  __esModule: true,
  useAudioEngine: () => engineMock,
  default: () => engineMock
}));

import {
  useRecordController,
  UNVOICED_MIDI,
  type RecordController
} from '../useRecordController';

// ---- hook harness ----
function Harness({ onReady }: { onReady: (api: RecordController) => void }): null {
  const api = useRecordController();
  onReady(api);
  return null;
}

interface Mounted {
  api: () => RecordController;
  tree: TestRenderer.ReactTestRenderer;
}

function mount(): Mounted {
  let latest: RecordController | null = null;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(Harness, { onReady: (a) => (latest = a) })
    );
  });
  return {
    api: () => latest as unknown as RecordController,
    tree
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  pitchCb = null;
  engineMock.requestPermission.mockResolvedValue(true);
});

const sample = (over: Partial<PitchSample> = {}): PitchSample => ({
  timestampMs: 10,
  frequencyHz: 440,
  clarity: 0.99,
  midi: 69,
  cents: 0,
  ...over
});

describe('useRecordController', () => {
  it('starts in idle with cleared shared values', () => {
    const { api } = mount();
    expect(api().state).toBe('idle');
    expect(api().isRecording).toBe(false);
    expect(api().sharedMidi.value).toBe(UNVOICED_MIDI);
    expect(api().sharedPitch.value).toBe(0);
  });

  it('start() requests permission, subscribes once, and starts the engine', async () => {
    const { api } = mount();
    await act(async () => {
      await api().start();
    });

    expect(engineMock.requestPermission).toHaveBeenCalledTimes(1);
    expect(engineMock.start).toHaveBeenCalledTimes(1);
    expect(engineMock.onPitch).toHaveBeenCalledTimes(1);
    expect(api().state).toBe('recording');
    expect(api().isRecording).toBe(true);
  });

  it('writes each emitted frame into the shared values (no React state)', async () => {
    const { api } = mount();
    await act(async () => {
      await api().start();
    });

    act(() => {
      engineMock.__emit(
        sample({ frequencyHz: 220, clarity: 0.8, midi: 57, cents: 12 })
      );
    });

    expect(api().sharedPitch.value).toBe(220);
    expect(api().sharedClarity.value).toBe(0.8);
    expect(api().sharedMidi.value).toBe(57);
    expect(api().sharedCents.value).toBe(12);
    expect(api().sharedFrame.value).toBe(1);
  });

  it('maps an unvoiced frame to the sentinel and zero cents', async () => {
    const { api } = mount();
    await act(async () => {
      await api().start();
    });
    act(() => {
      engineMock.__emit(sample({ frequencyHz: 0, midi: null, cents: null }));
    });
    expect(api().sharedMidi.value).toBe(UNVOICED_MIDI);
    expect(api().sharedCents.value).toBe(0);
  });

  it('stop() detaches the subscription, stops the engine, resolves the handle', async () => {
    const { api } = mount();
    await act(async () => {
      await api().start();
    });

    let resolved: RecordingHandle | null = null;
    await act(async () => {
      resolved = await api().stop();
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(engineMock.stop).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual(handle);
    expect(api().state).toBe('result');
  });

  it('stops feeding shared values after stop()', async () => {
    const { api } = mount();
    await act(async () => {
      await api().start();
    });
    await act(async () => {
      await api().stop();
    });
    const before = api().sharedFrame.value;
    act(() => {
      engineMock.__emit(sample({ frequencyHz: 999 }));
    });
    expect(api().sharedFrame.value).toBe(before);
  });

  it('rejects and does not subscribe when permission is denied', async () => {
    engineMock.requestPermission.mockResolvedValueOnce(false);
    const { api } = mount();

    await act(async () => {
      await expect(api().start()).rejects.toThrow(/permission/i);
    });

    expect(engineMock.start).not.toHaveBeenCalled();
    expect(engineMock.onPitch).not.toHaveBeenCalled();
    expect(api().state).toBe('error');
  });

  it('tears down the subscription on unmount', async () => {
    const { api, tree } = mount();
    await act(async () => {
      await api().start();
    });
    act(() => {
      tree.unmount();
    });
    expect(unsubscribe).toHaveBeenCalled();
  });
});
