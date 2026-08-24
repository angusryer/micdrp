/**
 * Downbeats read from where the harmony turns over (INV-NOTES-049).
 */
import { evenOutIfClose, proposeDownbeats } from '../downbeats';
import type { MusicalGrid } from '../quantize';
import type { NoteEvent } from '../segmentation';

/** 120bpm: a beat is 500ms, a step is 125ms. */
const GRID = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  isCompound: false,
  timeSignature: '4/4',
  meterIsStated: true
} as unknown as MusicalGrid;

function note(midi: number, startMs: number, endMs: number): NoteEvent {
  return { midi, startMs, endMs, durationMs: endMs - startMs, cents: 0, clarity: 1, loudnessDb: null };
}

describe('downbeats are read from the music', () => {
  it('proposes one at the first note when the harmony never turns over', () => {
    // A C major arpeggio throughout: one chord, so one downbeat.
    const steady = [
      note(60, 0, 500),
      note(64, 500, 1000),
      note(67, 1000, 1500),
      note(60, 1500, 2000)
    ];
    expect(proposeDownbeats(steady, GRID)).toEqual([0]);
  });

  it('proposes a second where the harmony changes', () => {
    // C major for two seconds, then F major for two.
    const turning = [
      note(60, 0, 600),
      note(64, 600, 1200),
      note(67, 1200, 2000),
      note(65, 2000, 2600),
      note(69, 2600, 3200),
      note(72, 3200, 4000)
    ];
    const steps = proposeDownbeats(turning, GRID);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps[0]).toBe(0);
    // The change lands on the note that begins the new harmony, step 16.
    expect(steps).toContain(16);
  });

  it('never puts two closer together than a beat', () => {
    const busy = Array.from({ length: 16 }, (_, i) =>
      note(60 + (i % 2 === 0 ? 0 : 6), i * 150, i * 150 + 150)
    );
    const steps = proposeDownbeats(busy, GRID);
    for (let i = 1; i < steps.length; i++) {
      // A beat is 4 steps at this grid.
      expect(steps[i] - steps[i - 1]).toBeGreaterThanOrEqual(4);
    }
  });

  it('has nothing to say about nothing', () => {
    expect(proposeDownbeats([], GRID)).toEqual([]);
    expect(proposeDownbeats([note(60, 0, 500)], { ...GRID, bpm: 0 })).toEqual([]);
  });

  it('lands every downbeat on a note onset', () => {
    const turning = [
      note(60, 0, 700),
      note(64, 700, 1400),
      note(65, 1400, 2100),
      note(69, 2100, 2800)
    ];
    const onsets = turning.map((n) => Math.round(n.startMs / 125));
    for (const step of proposeDownbeats(turning, GRID)) {
      expect(onsets).toContain(step);
    }
  });
});

describe('evening out gaps that are already nearly even', () => {
  it('straightens a wobble', () => {
    // Gaps of 1000, 1040, 970 — near enough a steady 1000.
    expect(evenOutIfClose([0, 1000, 2040, 3010], 0.25)).toEqual([0, 1000, 2000, 3000]);
  });

  it('leaves a take with its own shape alone', () => {
    // Gaps of 1000 then 3000: genuinely uneven, and meant.
    const uneven = [0, 1000, 4000];
    expect(evenOutIfClose(uneven, 0.25)).toEqual(uneven);
  });

  it('needs at least three points to see a pattern at all', () => {
    expect(evenOutIfClose([0, 1234], 0.25)).toEqual([0, 1234]);
    expect(evenOutIfClose([], 0.25)).toEqual([]);
  });
});

describe('the window is counted in notes, not milliseconds', () => {
  it('reads a fast passage and a slow one the same way', () => {
    // The same six pitches, once at 150ms a note and once at 900ms. A fixed
    // time window reads the first as noise and the second as barely anything;
    // counting notes reads both as the same music.
    const pitches = [60, 64, 67, 65, 69, 72];
    const fast = pitches.map((m, i) => note(m, i * 150, i * 150 + 150));
    const slow = pitches.map((m, i) => note(m, i * 900, i * 900 + 900));

    const fastBeats = proposeDownbeats(fast, GRID, { minGapBeats: 0 });
    const slowBeats = proposeDownbeats(slow, GRID, { minGapBeats: 0 });

    // Same count, and each lands on the same note of the phrase.
    expect(fastBeats).toHaveLength(slowBeats.length);
    const asNoteIndex = (steps: number[], notes: typeof fast) =>
      steps.map((s) =>
        notes.findIndex((n) => Math.round(n.startMs / 125) === s)
      );
    expect(asNoteIndex(fastBeats, fast)).toEqual(asNoteIndex(slowBeats, slow));
  });

  it('asks nothing of a phrase too short to spell a chord twice', () => {
    const tiny = [note(60, 0, 500), note(64, 500, 1000)];
    expect(proposeDownbeats(tiny, GRID)).toEqual([0]);
  });
});
