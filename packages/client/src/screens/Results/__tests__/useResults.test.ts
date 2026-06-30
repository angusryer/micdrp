/**
 * Unit tests for the Results offline pipeline + practice-progress persistence.
 *
 * These exercise the REAL `logic` pipeline (smoothPitch → segmentNotes →
 * notesToMidi → scorePitch) and the REAL on-device `computeFeedback` over a
 * synthetic `PitchSample[]` fixture. Only the side-effecting seams are mocked:
 * `data/files.writeMidi` (fs) and `data/practiceProgressRepo` (Supabase).
 * Persistence is asserted by reading the `CreatePracticeProgressInput` the repo
 * was given — a practice take writes a trajectory row, not a recording.
 *
 * The hook is driven through a tiny harness rendered with `react-test-renderer`.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { notesToMidi, segmentNotes, smoothPitch } from 'logic';
import type { PracticeProgressDto } from 'shared';

import type { PitchSample, RecordingHandle } from '../../../audio/contract';
import type { PracticeParams } from '../../../navigation/types';
import { analyzeHandle, useResults, type UseResultsValue } from '../useResults';

// fs seam: writeMidi resolves a deterministic file:// URI without touching disk.
jest.mock('../../../data/files', () => ({
  writeMidi: jest.fn((id: string) => Promise.resolve(`file:///mock/${id}.mid`))
}));

// Supabase seam: practiceProgressRepo.create echoes a canonical row.
jest.mock('../../../data/practiceProgressRepo', () => ({
  practiceProgressRepo: {
    create: jest.fn()
  }
}));

import { writeMidi } from '../../../data/files';
import { practiceProgressRepo } from '../../../data/practiceProgressRepo';

const createMock = practiceProgressRepo.create as jest.MockedFunction<
  typeof practiceProgressRepo.create
>;

const PRACTICE: PracticeParams = {
  melodyId: 'major-scale',
  rootMidi: 60,
  noteDurationMs: 400
};

function progressFor(
  over: Partial<PracticeProgressDto> = {}
): PracticeProgressDto {
  return {
    id: 'prog-test',
    userId: 'user-1',
    createdAtMs: 1_000,
    melodyId: 'major-scale',
    rootMidi: 60,
    noteDurationMs: 400,
    score: 80,
    inTuneRatio: 0.9,
    meanCentsError: 12,
    evaluatedFrames: 30,
    ...over
  };
}

/**
 * Build a synthetic frame stream: hold each MIDI note for `framesPerNote` frames
 * at 10ms spacing, with a single-frame outlier the median filter must absorb so
 * segmentation yields exactly the input melody.
 */
function fixtureSamples(): PitchSample[] {
  const melody = [60, 62, 64]; // C4, D4, E4
  const framesPerNote = 12; // 120ms per note > default 60ms min duration
  const samples: PitchSample[] = [];
  let t = 0;
  for (let n = 0; n < melody.length; n++) {
    const midi = melody[n];
    for (let i = 0; i < framesPerNote; i++) {
      const isOutlier = i === 5;
      const m = isOutlier ? midi + 12 : midi;
      samples.push({
        timestampMs: t,
        frequencyHz: 440 * Math.pow(2, (m - 69) / 12),
        clarity: 0.97,
        midi: m,
        cents: 0
      });
      t += 10;
    }
  }
  return samples;
}

function makeHandle(over: Partial<RecordingHandle> = {}): RecordingHandle {
  return {
    id: 'rec-test',
    uri: 'file:///mock/rec-test.wav',
    sampleRateHz: 44100,
    durationMs: 360,
    samples: fixtureSamples(),
    ...over
  };
}

/** Render the hook and surface its latest value; flush pending microtasks. */
async function renderUseResults(
  handle: RecordingHandle,
  options?: Parameters<typeof useResults>[1]
): Promise<{ value: () => UseResultsValue; unmount: () => void }> {
  let latest: UseResultsValue | null = null;
  function Harness(): null {
    latest = useResults(handle, options);
    return null;
  }
  let tree: TestRenderer.ReactTestRenderer | null = null;
  await act(async () => {
    tree = TestRenderer.create(React.createElement(Harness));
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    value: () => latest as UseResultsValue,
    unmount: () => (tree as unknown as TestRenderer.ReactTestRenderer).unmount()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  createMock.mockResolvedValue(progressFor());
});

describe('analyzeHandle (pure pipeline)', () => {
  it('segments the fixture into the three sung notes, absorbing outliers', () => {
    const { notes } = analyzeHandle(makeHandle());
    expect(notes.map((n) => n.midi)).toEqual([60, 62, 64]);
  });

  it('produces MIDI bytes identical to running logic directly on smoothed frames', () => {
    const handle = makeHandle();
    const { midi, notes } = analyzeHandle(handle);

    const expected = notesToMidi(segmentNotes(smoothPitch(handle.samples)));
    expect(Array.from(midi)).toEqual(Array.from(expected));

    expect(Array.from(midi.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    const noteOns = Array.from(midi).filter((b) => b === 0x90).length;
    expect(noteOns).toBeGreaterThanOrEqual(notes.length);
  });

  it('scores against the self grid and synthesizes feedback', () => {
    const { score, feedback } = analyzeHandle(makeHandle());
    expect(score.evaluatedFrames).toBeGreaterThan(0);
    expect(feedback.perNote).toHaveLength(3);
    expect(feedback.overallScore).toBeGreaterThan(0);
  });
});

describe('useResults (practice-progress persistence)', () => {
  it('writes the .mid and creates a progress row exactly once', async () => {
    const { value } = await renderUseResults(makeHandle(), {
      practice: PRACTICE
    });

    expect(writeMidi).toHaveBeenCalledTimes(1);
    expect(writeMidi).toHaveBeenCalledWith('rec-test', expect.any(Uint8Array));

    expect(createMock).toHaveBeenCalledTimes(1);
    const [input] = createMock.mock.calls[0];
    expect(input.melodyId).toBe('major-scale');
    expect(input.rootMidi).toBe(60);
    expect(input.noteDurationMs).toBe(400);
    expect(typeof input.score).toBe('number');
    expect(typeof input.evaluatedFrames).toBe('number');

    const v = value();
    expect(v.status).toBe('saved');
    expect(v.midiUri).toBe('file:///mock/rec-test.mid');
    expect(v.progress?.id).toBe('prog-test');
    expect(v.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
  });

  it('does not persist without practice params (analysis still available)', async () => {
    const { value } = await renderUseResults(makeHandle(), {});

    expect(writeMidi).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(value().notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(value().feedback.perNote).toHaveLength(3);
    expect(value().status).toBe('idle');
  });

  it('does not persist when persist:false', async () => {
    const { value } = await renderUseResults(makeHandle(), {
      practice: PRACTICE,
      persist: false
    });

    expect(writeMidi).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(value().status).toBe('idle');
  });

  it('surfaces an error status when the cloud create fails', async () => {
    createMock.mockRejectedValueOnce(new Error('network'));

    const { value } = await renderUseResults(makeHandle(), {
      practice: PRACTICE
    });

    expect(value().status).toBe('error');
    expect(value().progress).toBeNull();
  });

  it('persists only once across re-renders for the same handle', async () => {
    const handle = makeHandle();

    let renderApi: UseResultsValue | null = null;
    function Harness({ tick }: { tick: number }): null {
      void tick; // force a prop change → re-render
      renderApi = useResults(handle, { practice: PRACTICE });
      return null;
    }

    let tree: TestRenderer.ReactTestRenderer | null = null;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(Harness, { tick: 0 }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      (tree as unknown as TestRenderer.ReactTestRenderer).update(
        React.createElement(Harness, { tick: 1 })
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(renderApi).not.toBeNull();
    expect(writeMidi).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
