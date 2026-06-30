/**
 * Unit tests for on-device feedback synthesis (WP-CLIENT-ANALYSIS).
 *
 * These run the REAL `logic` pipeline (smoothPitch → segmentNotes → scorePitch +
 * detectKey + estimateTempo) over synthetic `PitchSample[]` fixtures and assert a
 * sensible `shared` `FeedbackDto`. No mocks: `computeFeedback` is pure over
 * `handle.samples`, so there is no I/O to stub.
 */
import { DEFAULT_TOLERANCE_CENTS } from 'logic';

import type { PitchSample, RecordingHandle } from '../../audio/contract';
import { computeFeedback } from '../feedback';

/**
 * Build a frame stream that sustains a melody in A minor (A, C, E, A) at a
 * steady 500ms-per-note cadence (≈120 BPM). Each note is held for 50 frames at
 * 10ms spacing; `cents` controls how far off-centre the singer sits.
 */
function melodyFixture(centsPerNote: number[]): PitchSample[] {
  // A3, C4, E4, A4 — an A-minor arpeggio across two octaves.
  const melody = [57, 60, 64, 69];
  const framesPerNote = 50; // 500ms each → onsets every 500ms ≈ 120 BPM
  const samples: PitchSample[] = [];
  let t = 0;
  for (let n = 0; n < melody.length; n++) {
    const midi = melody[n];
    const cents = centsPerNote[n] ?? 0;
    for (let i = 0; i < framesPerNote; i++) {
      samples.push({
        timestampMs: t,
        frequencyHz: 440 * Math.pow(2, (midi - 69 + cents / 100) / 12),
        clarity: 0.98,
        midi,
        cents
      });
      t += 10;
    }
  }
  return samples;
}

function makeHandle(samples: PitchSample[]): RecordingHandle {
  const durationMs = samples.length > 0 ? samples[samples.length - 1].timestampMs + 10 : 0;
  return {
    id: 'fb-test',
    uri: 'file:///mock/fb-test.wav',
    sampleRateHz: 44100,
    durationMs,
    samples
  };
}

describe('computeFeedback', () => {
  it('scores a well-sung take highly and praises intonation', () => {
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])));

    expect(fb.overallScore).toBeGreaterThan(90);
    expect(fb.inTuneRatio).toBeGreaterThan(0.9);
    expect(fb.meanCentsError).toBeLessThan(DEFAULT_TOLERANCE_CENTS);
    expect(fb.strengths.length).toBeGreaterThan(0);
    // A clean, in-tune take should not be flagged for pitch drift.
    expect(fb.improvements.join(' ')).not.toMatch(/drifted/i);
  });

  it('detects the key and tempo of a steady arpeggio', () => {
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])));

    // The A-minor arpeggio should resolve to an A tonic.
    expect(fb.key).not.toBeNull();
    expect(fb.key).toMatch(/^A /);

    expect(fb.tempoBpm).not.toBeNull();
    // 500ms onsets → ~120 BPM (allow the estimator's harmonic latitude).
    expect(fb.tempoBpm).toBeGreaterThan(90);
    expect(fb.tempoBpm).toBeLessThanOrEqual(240);
  });

  it('emits one perNote entry per sung note with cents + inTune flags', () => {
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])));

    expect(fb.perNote).toHaveLength(4);
    fb.perNote.forEach((note, index) => {
      expect(note.index).toBe(index);
      expect(typeof note.midi).toBe('number');
      expect(typeof note.centsError).toBe('number');
      expect(note.inTune).toBe(Math.abs(note.centsError) <= DEFAULT_TOLERANCE_CENTS);
    });
    expect(fb.perNote.map((n) => n.midi)).toEqual([57, 60, 64, 69]);
  });

  it('flags improvements and suggestions for an off-pitch take', () => {
    // Sit ~80 cents sharp on every note: still the same MIDI notes, but the
    // self-target frame scoring punishes the steady offset.
    const fb = computeFeedback(makeHandle(melodyFixture([80, 80, 80, 80])));

    expect(fb.overallScore).toBeLessThan(90);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.suggestions.length).toBeGreaterThan(0);
    // The per-note cents offset exceeds tolerance, so notes read out-of-tune.
    expect(fb.perNote.every((n) => !n.inTune)).toBe(true);
  });

  it('returns guidance (never empty) for a silent take', () => {
    const fb = computeFeedback(makeHandle([]));

    expect(fb.overallScore).toBe(0);
    expect(fb.inTuneRatio).toBe(0);
    expect(fb.key).toBeNull();
    expect(fb.tempoBpm).toBeNull();
    expect(fb.perNote).toHaveLength(0);
    expect(fb.improvements.length).toBeGreaterThan(0);
    expect(fb.suggestions.length).toBeGreaterThan(0);
  });
});

describe('computeFeedback against an external practice melody', () => {
  // The fixture sings A3, C4, E4, A4, each held for 500ms.
  const matchingTargets = [
    { midi: 57, startMs: 0, endMs: 500 },
    { midi: 60, startMs: 500, endMs: 1000 },
    { midi: 64, startMs: 1000, endMs: 1500 },
    { midi: 69, startMs: 1500, endMs: 2000 }
  ];

  it('scores a take that matches the target melody highly, one perNote per target', () => {
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])), matchingTargets);

    expect(fb.overallScore).toBeGreaterThan(90);
    expect(fb.perNote).toHaveLength(matchingTargets.length);
    expect(fb.perNote.map((n) => n.midi)).toEqual([57, 60, 64, 69]);
    expect(fb.perNote.every((n) => n.inTune)).toBe(true);
  });

  it('punishes a take sung a tone away from the target', () => {
    // Target a whole tone above what was actually sung → every note is ~200 cents off.
    const shifted = matchingTargets.map((t) => ({ ...t, midi: t.midi + 2 }));
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])), shifted);

    expect(fb.overallScore).toBeLessThan(50);
    expect(fb.perNote.every((n) => !n.inTune)).toBe(true);
  });

  it('falls back to self-scoring when given an empty target list', () => {
    const fb = computeFeedback(makeHandle(melodyFixture([0, 0, 0, 0])), []);
    // Same as the no-argument self-referential behaviour.
    expect(fb.perNote.map((n) => n.midi)).toEqual([57, 60, 64, 69]);
    expect(fb.overallScore).toBeGreaterThan(90);
  });
});
