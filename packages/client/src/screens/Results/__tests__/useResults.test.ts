/**
 * Unit tests for the Results offline pipeline hook (WP-RESULTS-UI).
 *
 * These exercise the REAL `logic` pipeline (smoothPitch → segmentNotes →
 * notesToMidi / scorePitch) over a synthetic `PitchSample[]` fixture. Only the
 * side-effecting seams are mocked: `data/files.writeMidi` (fs) and
 * `react-native-share`. Persistence is asserted by spying on
 * `data/recordings.saveRecording` and reading the record it was given.
 *
 * The hook is driven through a tiny harness rendered with `react-test-renderer`
 * (a declared devDependency), matching the existing hook tests. No device needed.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { notesToMidi, segmentNotes, smoothPitch, type TargetNote } from 'logic';

import type { PitchSample, RecordingHandle } from '../../../audio/contract';
import * as recordings from '../../../data/recordings';
import { analyzeHandle, useResults, type UseResultsValue } from '../useResults';

// fs seam: writeMidi resolves a deterministic file:// URI without touching disk.
jest.mock('../../../data/files', () => ({
  writeMidi: jest.fn((id: string) => Promise.resolve(`file:///mock/${id}.mid`))
}));
// share seam (unused by the hook, mocked for import safety / parity with screen).
jest.mock(
  'react-native-share',
  () => ({ default: { open: jest.fn(() => Promise.resolve()) } }),
  { virtual: true }
);

import { writeMidi } from '../../../data/files';

/**
 * Build a synthetic frame stream: hold each MIDI note for `framesPerNote` frames
 * at 10ms spacing, with a couple of single-frame outliers the median filter must
 * absorb so segmentation yields exactly the input melody.
 */
function fixtureSamples(): PitchSample[] {
  const melody = [60, 62, 64]; // C4, D4, E4
  const framesPerNote = 12; // 120ms per note > default 60ms min duration
  const samples: PitchSample[] = [];
  let t = 0;
  for (let n = 0; n < melody.length; n++) {
    const midi = melody[n];
    for (let i = 0; i < framesPerNote; i++) {
      // Inject a one-frame octave-jump outlier mid-note; smoothing removes it.
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
  });
  return {
    value: () => latest as UseResultsValue,
    unmount: () => (tree as unknown as TestRenderer.ReactTestRenderer).unmount()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('analyzeHandle (pure pipeline)', () => {
  it('segments the fixture into the three sung notes, absorbing outliers', () => {
    const handle = makeHandle();
    const { notes } = analyzeHandle(handle);
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

  it('returns a null score when no target melody is supplied', () => {
    expect(analyzeHandle(makeHandle()).score).toBeNull();
  });

  it('scores against a target melody when provided', () => {
    const target: TargetNote[] = [
      { midi: 60, startMs: 0, endMs: 120 },
      { midi: 62, startMs: 120, endMs: 240 },
      { midi: 64, startMs: 240, endMs: 360 }
    ];
    const score = analyzeHandle(makeHandle(), target).score;
    expect(score).not.toBeNull();
    expect(score?.score).toBeGreaterThan(80);
    expect(score?.inTuneRatio).toBeGreaterThan(0.8);
    expect(score?.evaluatedFrames).toBeGreaterThan(0);
  });
});

describe('useResults (persistence)', () => {
  it('writes the .mid and persists a RecordingMeta exactly once', async () => {
    const saveSpy = jest.spyOn(recordings, 'saveRecording');
    const handle = makeHandle();

    const { value } = await renderUseResults(handle, { createdAtMs: 1_000, title: 'My Take' });

    expect(writeMidi).toHaveBeenCalledTimes(1);
    expect(writeMidi).toHaveBeenCalledWith('rec-test', expect.any(Uint8Array));

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const saved = saveSpy.mock.calls[0][0];
    expect(saved.id).toBe('rec-test');
    expect(saved.title).toBe('My Take');
    expect(saved.createdAtMs).toBe(1_000);
    expect(saved.durationMs).toBe(360);
    expect(saved.sampleRateHz).toBe(44100);
    expect(saved.audioUri).toBe('file:///mock/rec-test.wav');
    expect(saved.midiUri).toBe('file:///mock/rec-test.mid');
    expect(saved.noteCount).toBe(3);

    const v = value();
    expect(v.status).toBe('saved');
    expect(v.midiUri).toBe('file:///mock/rec-test.mid');
    expect(v.notes.map((n) => n.midi)).toEqual([60, 62, 64]);
  });

  it('records the pitch score on the persisted meta when a target is given', async () => {
    const saveSpy = jest.spyOn(recordings, 'saveRecording');
    const target: TargetNote[] = [{ midi: 60, startMs: 0, endMs: 360 }];

    await renderUseResults(makeHandle(), { createdAtMs: 1, target });

    const saved = saveSpy.mock.calls[0][0];
    expect(typeof saved.score).toBe('number');
  });

  it('does not persist when persist:false (analysis still available)', async () => {
    const saveSpy = jest.spyOn(recordings, 'saveRecording');

    const { value } = await renderUseResults(makeHandle(), { persist: false });

    expect(writeMidi).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(value().notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(value().status).toBe('idle');
  });

  it('persists only once across re-renders for the same handle', async () => {
    const saveSpy = jest.spyOn(recordings, 'saveRecording');
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
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
