/**
 * INV-PITCH-022 — the tempo somebody counted, read back.
 *
 * Every other tempo reading is an inference from music, which is genuinely
 * hard: onsets fall on some beats and not others, syncopation lies, and the
 * strongest periodicity is often twice or half what a person would tap. A
 * count is not an inference. It is somebody stating the tempo out loud, and
 * the job here is only to not lose it.
 *
 * The accents are what make it a count. Even spacing on its own describes a
 * metronomic melody exactly as well, and this reading exists to *override* the
 * general fitter — so it has to be sure rather than merely plausible. That
 * makes loudness the thing the whole feature rests on, and takes with no
 * measured loudness keep the tempo they have always had.
 */
import { readSungCount } from '../sungCount';
import type { NoteEvent } from '../segmentation';

const beat = (
  startMs: number,
  loudnessDb: number | null = null,
  durationMs = 150
): NoteEvent => ({
  midi: 60,
  startMs,
  endMs: startMs + durationMs,
  durationMs,
  cents: 0,
  clarity: 1,
  loudnessDb
});

/** Beats at a steady tempo, stressed every `accentEvery` if given. */
const counted = (
  beatMs = 500,
  beats = 5,
  accentEvery: number | null = 4
): NoteEvent[] =>
  Array.from({ length: beats }, (_, i) =>
    beat(
      i * beatMs,
      accentEvery == null ? null : i % accentEvery === 0 ? -8 : -16
    )
  );

describe('a count at the head of a take', () => {
  it('reads the beat that was counted', () => {
    const read = readSungCount(counted(500));
    expect(read?.beatMs).toBeCloseTo(500, 6);
    expect(read?.beats).toBe(5);
  });

  it('says where the count stops, so the music can start after it', () => {
    const read = readSungCount(counted(500));
    expect(read?.startMs).toBe(0);
    expect(read?.endMs).toBe(2150);
  });

  it('reads the metre off where the stresses fell', () => {
    // "ONE two three four ONE" — the accent period is the bar.
    expect(readSungCount(counted(500, 5, 4))?.beatsPerBar).toBe(4);
    expect(readSungCount(counted(500, 7, 3))?.beatsPerBar).toBe(3);
  });
});

describe('what is not a count', () => {
  it('refuses an even run with no accents in it', () => {
    // This is the case that matters most. Steady quarter notes are even in
    // exactly the way a count is, and treating them as a stated tempo would
    // let this override the fitter on takes that never had a count — which
    // is how it first went wrong: a waltz came back as 4/4.
    expect(readSungCount(counted(500, 6, null))).toBeNull();
  });

  it('refuses a take whose loudness was never measured', () => {
    // Every take captured before levels existed, and any recorded by a binary
    // older than the bundle reading it. They keep the tempo they always had.
    const unmeasured = [0, 1, 2, 3, 4].map((i) => beat(i * 500));
    expect(readSungCount(unmeasured)).toBeNull();
  });

  it('refuses a count that is merely quiet, with no beat stressed', () => {
    expect(readSungCount([0, 1, 2, 3, 4].map((i) => beat(i * 500, -40)))).toBeNull();
  });

  it('refuses two or three beats, which is coincidence not tempo', () => {
    expect(readSungCount(counted(500, 2))).toBeNull();
    expect(readSungCount(counted(500, 3))).toBeNull();
  });

  it('refuses an uneven opening', () => {
    // A tune that opens with a rhythm rather than a count.
    const loud = (ms: number, db: number) => beat(ms, db);
    expect(
      readSungCount([
        loud(0, -8),
        loud(300, -16),
        loud(1100, -16),
        loud(1300, -16),
        loud(2400, -8)
      ])
    ).toBeNull();
  });

  it('refuses an empty take', () => {
    expect(readSungCount([])).toBeNull();
  });

  it('stops at the first beat that breaks the pattern', () => {
    // Five counted, then the tune comes in somewhere else entirely. What was
    // counted is a count; what follows is not part of it.
    const read = readSungCount([
      ...counted(500, 5),
      beat(2800, -14),
      beat(2950, -14),
      beat(4400, -14)
    ]);
    expect(read?.beats).toBe(5);
    expect(read?.beatMs).toBeCloseTo(500, 6);
  });

  it('reads a count only at the head, never from a figure inside the take', () => {
    // An even, accented run in the middle is a repeated figure. Reading tempo
    // off it would let one bar of the music overrule everything around it.
    const read = readSungCount([
      beat(0, -12),
      beat(370, -12),
      beat(1500, -12),
      ...counted(500, 5).map((n) => ({ ...n, startMs: n.startMs + 4000 }))
    ]);
    expect(read).toBeNull();
  });
});

describe('how much the count is trusted', () => {
  it('trusts a dead-even count', () => {
    expect(readSungCount(counted(500, 5))?.confidence).toBeGreaterThan(0.9);
  });

  it('trusts a ragged one less', () => {
    const at = [0, 500, 1040, 1500, 2030];
    const ragged = at.map((ms, i) => beat(ms, i % 4 === 0 ? -8 : -16));
    const read = readSungCount(ragged);
    expect(read).not.toBeNull();
    expect(read?.confidence).toBeLessThan(0.75);
  });

  it('trusts a longer count at least as much as the shortest it accepts', () => {
    const short = readSungCount(counted(500, 5))?.confidence ?? 0;
    const long = readSungCount(counted(500, 9))?.confidence ?? 0;
    expect(long).toBeGreaterThanOrEqual(short);
  });
});
