/**
 * Unit tests for usePracticeSession.
 *
 * The record controller, reference-tone player, and route detection are mocked,
 * so we assert the orchestration: target/duration derivation, the play-along
 * path (headphones → start recording then play the reference), and cancel.
 * The count-in (speaker) path is timer-driven and covered by inspection.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import type { RecordingHandle } from '../../../audio/contract';
import type { PracticeParams } from '../../../navigation/types';

const HANDLE: RecordingHandle = {
  id: 'p1',
  uri: 'file:///mock/p1.wav',
  sampleRateHz: 44100,
  durationMs: 3500,
  samples: []
};

const mockStart = jest.fn(() => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve(HANDLE));
const controllerState = { isRecording: false };

jest.mock('../../Record/useRecordController', () => ({
  useRecordController: () => ({
    sharedPitch: { value: 0 },
    sharedClarity: { value: 0 },
    sharedMidi: { value: 0 },
    sharedCents: { value: 0 },
    sharedFrame: { value: 0 },
    start: mockStart,
    stop: mockStop,
    get isRecording() {
      return controllerState.isRecording;
    },
    state: 'idle'
  }),
  UNVOICED_MIDI: -1
}));

const mockPlay = jest.fn();
const mockTonePlayerStop = jest.fn();
jest.mock('../../../audio/referenceTone', () => ({
  createReferenceTonePlayer: () => ({ play: mockPlay, stop: mockTonePlayerStop })
}));

const mockDetectHeadphones = jest.fn();
jest.mock('../../../audio/outputRoute', () => ({
  detectHeadphonesConnected: (...a: unknown[]) => mockDetectHeadphones(...a)
}));

import { usePracticeSession, type UsePracticeSessionValue } from '../usePracticeSession';

const PARAMS: PracticeParams = {
  melodyId: 'major-scale',
  rootMidi: 60,
  noteDurationMs: 500
};

function Harness({
  params,
  onReady
}: {
  params: PracticeParams;
  onReady: (v: UsePracticeSessionValue) => void;
}): null {
  onReady(usePracticeSession(params));
  return null;
}

function mount(params: PracticeParams = PARAMS): { api: () => UsePracticeSessionValue } {
  let latest: UsePracticeSessionValue | null = null;
  void act(() => {
    TestRenderer.create(
      React.createElement(Harness, {
        params,
        onReady: (v) => {
          latest = v;
        }
      })
    );
  });
  return {
    api: () => {
      if (latest === null) {
        throw new Error('hook did not render');
      }
      return latest;
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  controllerState.isRecording = false;
});

describe('usePracticeSession derivation', () => {
  it('builds the melody targets and duration', () => {
    const { api } = mount();
    // major-scale has 15 notes at 500ms → 7500ms.
    expect(api().targets.length).toBe(15);
    expect(api().durationMs).toBe(7500);
    expect(api().phase).toBe('idle');
  });

  it('yields no targets for an unknown melody id', () => {
    const { api } = mount({ ...PARAMS, melodyId: 'nope' });
    expect(api().targets).toEqual([]);
    expect(api().durationMs).toBe(0);
  });
});

describe('begin (play-along, headphones present)', () => {
  it('starts recording then plays the reference along with it', async () => {
    mockDetectHeadphones.mockResolvedValue(true);
    const { api } = mount();

    await act(async () => {
      await api().begin();
    });

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    // Reference plays only after recording has started.
    expect(mockStart.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlay.mock.invocationCallOrder[0]
    );
    expect(api().phase).toBe('recording');
  });

  it('surfaces a permission rejection and returns to idle', async () => {
    mockDetectHeadphones.mockResolvedValue(true);
    mockStart.mockRejectedValueOnce(new Error('denied'));
    const { api } = mount();

    await act(async () => {
      await expect(api().begin()).rejects.toThrow('denied');
    });
    expect(api().phase).toBe('idle');
  });
});

describe('finish + cancel', () => {
  it('finish stops the engine and returns the handle', async () => {
    mockDetectHeadphones.mockResolvedValue(true);
    const { api } = mount();
    await act(async () => {
      await api().begin();
    });

    let handle: RecordingHandle | null = null;
    await act(async () => {
      handle = await api().finish();
    });
    expect(handle).toEqual(HANDLE);
    expect(mockTonePlayerStop).toHaveBeenCalled();
  });

  it('cancel stops the reference and engine while recording', async () => {
    controllerState.isRecording = true;
    const { api } = mount();
    await act(async () => {
      await api().cancel();
    });
    expect(mockTonePlayerStop).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
    expect(api().phase).toBe('idle');
  });
});
