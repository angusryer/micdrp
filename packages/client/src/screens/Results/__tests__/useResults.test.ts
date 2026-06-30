/**
 * Unit tests for the Results offline pipeline + cloud-persistence hook
 * (WP-CLIENT-ANALYSIS owns the Results wiring).
 *
 * These exercise the REAL `logic` pipeline (smoothPitch → segmentNotes →
 * notesToMidi) and the REAL on-device `computeFeedback` over a synthetic
 * `PitchSample[]` fixture. Only the side-effecting seams are mocked:
 * `data/files.writeMidi` (fs) and `data/recordingsRepo` (Supabase). Persistence
 * is asserted by reading the `CreateRecordingInput` + blobs the repo was given.
 *
 * The hook is driven through a tiny harness rendered with `react-test-renderer`
 * (a declared devDependency), matching the existing hook tests. No device needed.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { notesToMidi, segmentNotes, smoothPitch } from 'logic';
import type { RecordingDto } from 'shared';

import type { PitchSample, RecordingHandle } from '../../../audio/contract';
import { analyzeHandle, useResults, type UseResultsValue } from '../useResults';

// fs seam: writeMidi resolves a deterministic file:// URI without touching disk.
jest.mock('../../../data/files', () => ({
  writeMidi: jest.fn((id: string) => Promise.resolve(`file:///mock/${id}.mid`))
}));

// Supabase seam: recordingsRepo.create echoes a canonical RecordingDto.
jest.mock('../../../data/recordingsRepo', () => ({
  recordingsRepo: {
    create: jest.fn()
  }
}));

import { writeMidi } from '../../../data/files';
import { recordingsRepo } from '../../../data/recordingsRepo';

const createMock = recordingsRepo.create as jest.MockedFunction<
  typeof recordingsRepo.create
>;

function dtoFor(over: Partial<RecordingDto> = {}): RecordingDto {
  return {
    id: 'rec-test',
    userId: 'user-1',
    title: 'My Take',
    createdAtMs: 1_000,
    durationMs: 360,
    sampleRateHz: 44100,
    noteCount: 3,
    score: 100,
    key: 'C major',
    tempoBpm: null,
    audioPath: 'user-1/rec-test.m4a',
    midiPath: 'user-1/rec-test.mid',
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
  // Let the persistence effect's async chain settle.
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
  createMock.mockResolvedValue(dtoFor());
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

    // Sanity: a well-formed SMF header (MThd) and one note-on per note.
    expect(Array.from(midi.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    const noteOns = Array.from(midi).filter((b) => b === 0x90).length;
    expect(noteOns).toBeGreaterThanOrEqual(notes.length);
  });

  it('synthesizes on-device feedback alongside the notes', () => {
    const { feedback } = analyzeHandle(makeHandle());
    expect(feedback.perNote).toHaveLength(3);
    expect(feedback.overallScore).toBeGreaterThan(0);
    expect(feedback.strengths.length).toBeGreaterThan(0);
  });
});

describe('useResults (cloud persistence)', () => {
  it('writes the .mid and creates a cloud recording exactly once', async () => {
    const handle = makeHandle();

    const { value } = await renderUseResults(handle, {
      createdAtMs: 1_000,
      title: 'My Take'
    });

    expect(writeMidi).toHaveBeenCalledTimes(1);
    expect(writeMidi).toHaveBeenCalledWith('rec-test', expect.any(Uint8Array));

    expect(createMock).toHaveBeenCalledTimes(1);
    const [input, blobs] = createMock.mock.calls[0];
    expect(input.title).toBe('My Take');
    expect(input.durationMs).toBe(360);
    expect(input.sampleRateHz).toBe(44100);
    expect(input.noteCount).toBe(3);
    expect(typeof input.score).toBe('number');
    expect(blobs?.audioUri).toBe('file:///mock/rec-test.wav');
    expect(blobs?.midiBytes).toBeInstanceOf(Uint8Array);

    const v = value();
    expect(v.status).toBe('saved');
    expect(v.midiUri).toBe('file:///mock/rec-test.mid');
    expect(v.recording?.id).toBe('rec-test');
    expect(v.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
  });

  it('forwards the on-device key/tempo/score onto the create input', async () => {
    await renderUseResults(makeHandle(), { createdAtMs: 1 });

    const [input] = createMock.mock.calls[0];
    expect(input).toHaveProperty('key');
    expect(input).toHaveProperty('tempoBpm');
    expect(input).toHaveProperty('score');
  });

  it('does not persist when persist:false (analysis still available)', async () => {
    const { value } = await renderUseResults(makeHandle(), { persist: false });

    expect(writeMidi).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(value().notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(value().feedback.perNote).toHaveLength(3);
    expect(value().status).toBe('idle');
  });

  it('surfaces an error status when the cloud create fails', async () => {
    createMock.mockRejectedValueOnce(new Error('network'));

    const { value } = await renderUseResults(makeHandle(), { createdAtMs: 1 });

    expect(value().status).toBe('error');
    expect(value().recording).toBeNull();
  });

  it('persists only once across re-renders for the same handle', async () => {
    const handle = makeHandle();

    let renderApi: UseResultsValue | null = null;
    function Harness({ tick }: { tick: number }): null {
      void tick; // force a prop change → re-render
      renderApi = useResults(handle, { createdAtMs: 5 });
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
