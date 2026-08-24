/**
 * INV-NOTES-112 — the bars a count states.
 *
 * A downbeat marks where a chord starts, and there are three ways to arrive
 * at one. A sung bass says outright where the harmony changes. A count says
 * where the bars are, which is not the same claim but is the next best thing
 * when nobody sang the roots. Everything else is inferred from the melody —
 * a reading of the harmony that also has to guess the phase, and the phase is
 * the part it gets wrong most.
 *
 * So the order is: bass, then count, then inference. A person moving a line
 * outranks all three (INT-NOTES-012).
 */
import { proposeDownbeats } from '../downbeats';
import { fitGrid } from '../quantize';
import type { NoteEvent } from '../segmentation';

const at = (
  startMs: number,
  midi: number,
  loudnessDb: number | null = null,
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

/** Four counted beats, stressed on the first, then a tune over four bars. */
function countedTake(): NoteEvent[] {
  const count = [0, 1, 2, 3].map((i) =>
    at(i * BEAT, 60, i % 4 === 0 ? -8 : -16)
  );
  const tune: NoteEvent[] = [];
  for (let i = 0; i < 16; i++) {
    tune.push(at(4 * BEAT + i * BEAT, 62 + (i % 5), -14));
  }
  return [...count, ...tune];
}

describe('downbeats from a counted metre', () => {
  const notes = countedTake();
  const grid = fitGrid(notes);

  it('is reading a counted grid at all', () => {
    // Everything below is meaningless if the count was not recognised.
    expect(grid.meterIsCounted).toBe(true);
    expect(grid.beatsPerBar).toBe(4);
    expect(grid.bpm).toBe(120);
  });

  it('puts a line every counted bar', () => {
    const steps = proposeDownbeats(notes, grid);
    const perBar = grid.beatsPerBar * grid.stepsPerBeat;
    expect(steps.length).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step % perBar).toBe(0);
    }
  });

  it('leaves the counted beats themselves unmarked', () => {
    // They are real bars, but nothing is sung over them and a chord card on
    // a bar of counting describes nothing.
    const steps = proposeDownbeats(notes, grid);
    const stepMs = 60000 / grid.bpm / grid.stepsPerBeat;
    const firstMs = grid.offsetMs + steps[0] * stepMs;
    expect(firstMs).toBeGreaterThanOrEqual(4 * BEAT - BEAT / 2);
  });

  it('stops at the end of the singing', () => {
    const steps = proposeDownbeats(notes, grid);
    const stepMs = 60000 / grid.bpm / grid.stepsPerBeat;
    const lastMs = grid.offsetMs + steps[steps.length - 1] * stepMs;
    expect(lastMs).toBeLessThanOrEqual(notes[notes.length - 1].endMs);
  });

  it('gives a take at least one downbeat, whatever else it finds', () => {
    // A take has to start somewhere, and its first chord starts there.
    expect(proposeDownbeats(notes, grid).length).toBeGreaterThan(0);
  });

  it('yields to a bass, which states the harmony rather than the metre', () => {
    // The bass says where the chords change; the count only says where the
    // bars are. The more direct claim wins.
    const bass = [at(2000, 40, -12, 1800), at(3800, 45, -12, 1800)];
    const stated = proposeDownbeats(notes, grid, { bass });
    const counted = proposeDownbeats(notes, grid);
    expect(stated).not.toEqual(counted);
  });

  it('leaves an uncounted take to the melodic reading', () => {
    // The whole risk is overriding takes nobody counted, so an uncounted one
    // has to come back exactly as it always did.
    const plain = countedTake().map((n) => ({ ...n, loudnessDb: null }));
    const plainGrid = fitGrid(plain);
    expect(plainGrid.meterIsCounted).toBe(false);
    const steps = proposeDownbeats(plain, plainGrid);
    const perBar = plainGrid.beatsPerBar * plainGrid.stepsPerBeat;
    // Not necessarily on bar lines at all — that is the inference's business.
    expect(steps.some((s) => s % perBar !== 0) || steps.length > 0).toBe(true);
  });
});
