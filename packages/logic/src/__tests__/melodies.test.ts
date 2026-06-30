/**
 * Unit tests for the practice-melody catalogue.
 *
 * Validate the timeline invariants every melody must satisfy (so `scorePitch`
 * always finds exactly one target per instant), transposition, and pacing.
 */
import {
  PRACTICE_MELODIES,
  findMelody,
  sequenceToTargets
} from '../melodies';
import { scorePitch, type PitchFrame } from '../index';

describe('sequenceToTargets', () => {
  it('tiles contiguous, non-overlapping notes from the root', () => {
    const targets = sequenceToTargets([0, 2, 4], { rootMidi: 60, noteDurationMs: 400 });
    expect(targets).toEqual([
      { midi: 60, startMs: 0, endMs: 400 },
      { midi: 62, startMs: 400, endMs: 800 },
      { midi: 64, startMs: 800, endMs: 1200 }
    ]);
  });

  it('defaults to C4 / 500ms when no options are given', () => {
    const [first] = sequenceToTargets([0]);
    expect(first).toEqual({ midi: 60, startMs: 0, endMs: 500 });
  });
});

describe('PRACTICE_MELODIES', () => {
  it('has unique ids', () => {
    const ids = PRACTICE_MELODIES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PRACTICE_MELODIES.map((m) => [m.id, m] as const))(
    '%s builds a valid, gap-free timeline',
    (_id, melody) => {
      const targets = melody.build({ rootMidi: 57, noteDurationMs: 300 });
      expect(targets.length).toBeGreaterThan(0);

      let prevEnd = 0;
      for (const t of targets) {
        // Contiguous: each note starts where the previous ended.
        expect(t.startMs).toBe(prevEnd);
        expect(t.endMs).toBeGreaterThan(t.startMs);
        // Plausible MIDI range for a sung exercise.
        expect(t.midi).toBeGreaterThanOrEqual(40);
        expect(t.midi).toBeLessThanOrEqual(96);
        prevEnd = t.endMs;
      }
    }
  );
});

describe('findMelody', () => {
  it('resolves a known id', () => {
    expect(findMelody('major-scale')?.name).toBe('Major scale');
  });

  it('returns undefined for an unknown id', () => {
    expect(findMelody('nope')).toBeUndefined();
  });
});

describe('a melody scores against a perfectly on-pitch performance', () => {
  it('yields a top score when frames hold each target exactly', () => {
    const arpeggio = findMelody('major-arpeggio');
    if (!arpeggio) {
      throw new Error('major-arpeggio melody is missing from the catalogue');
    }
    const targets = arpeggio.build();
    // Synthesise a frame at the centre of every target note, dead on pitch.
    const frames: PitchFrame[] = targets.map((t) => ({
      timestampMs: (t.startMs + t.endMs) / 2,
      midi: t.midi,
      cents: 0,
      clarity: 1
    }));

    const score = scorePitch(frames, targets);
    expect(score.score).toBe(100);
    expect(score.inTuneRatio).toBe(1);
    expect(score.evaluatedFrames).toBe(targets.length);
  });
});
