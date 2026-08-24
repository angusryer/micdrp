/**
 * INV-NOTES-112 / INV-NOTES-050 — the take says a metre only where one was
 * stated.
 *
 * The screen has always refused to print a time signature, and for a good
 * reason: a hummed idea does not state one, and "4/4" over a take nobody
 * arranged is a guess wearing the clothes of a reading.
 *
 * A count is the exception, and the only one. Somebody counting four beats
 * and stressing the first has said 4/4 out loud, so reporting it is repeating
 * them rather than guessing. What this pins is that the exception stays an
 * exception.
 */
import en from '../../../i18n/locales/en.json';
import { fitGrid, proposeDownbeats } from 'logic';
import type { NoteEvent } from 'logic';

const at = (
  startMs: number,
  midi: number,
  loudnessDb: number | null,
  durationMs = 200
): NoteEvent => ({
  midi,
  startMs,
  endMs: startMs + durationMs,
  durationMs,
  cents: 0,
  clarity: 1,
  loudnessDb
});

const BEAT = 500;

/** Three counted beats stressed every third, then a tune. */
function waltzTake(loud = true): NoteEvent[] {
  const count = [0, 1, 2, 3, 4, 5].map((i) =>
    at(i * BEAT, 60, loud ? (i % 3 === 0 ? -8 : -16) : null)
  );
  const tune = Array.from({ length: 12 }, (_, i) =>
    at(6 * BEAT + i * BEAT, 62 + (i % 4), loud ? -14 : null)
  );
  return [...count, ...tune];
}

describe('what a counted take may claim', () => {
  it('has the words to say a tempo was counted', () => {
    // Reported differently from an inferred one, because it is a different
    // kind of claim and the screen should not blur them.
    expect(en.notes.stat.tempoCounted).toContain('{{bpm}}');
    expect(en.notes.stat.tempoCounted.toLowerCase()).toContain('count');
    expect(typeof en.notes.stat.metre).toBe('string');
  });

  it('reads the metre a count stated', () => {
    const grid = fitGrid(waltzTake());
    expect(grid.meterIsCounted).toBe(true);
    expect(grid.timeSignature).toBe('3/4');
  });

  it('claims nothing about metre when nobody counted', () => {
    // The same take with no loudness measured: no count, no claim. This is
    // every recording made before levels existed.
    const grid = fitGrid(waltzTake(false));
    expect(grid.meterIsCounted).toBe(false);
  });

  it('puts the bars where the counting said, not where a fit lands them', () => {
    const notes = waltzTake();
    const grid = fitGrid(notes);
    const steps = proposeDownbeats(notes, grid);
    const perBar = grid.beatsPerBar * grid.stepsPerBeat;
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step % perBar).toBe(0);
    }
  });
});
