/**
 * INV-NOTES-130 — the beat, tapped in by the person who sang it.
 *
 * Everything else infers where the beat is. The fitter deduces it from onsets,
 * which is hard; a sung count states it, but only for the bars somebody
 * counted. Tapping along says it for the whole take, continuously, by the one
 * party who knows — and there is nothing to detect, so nothing to get wrong.
 *
 * A tapped beat can be corrected and remembers where the finger landed.
 * Tapping along is played rather than typed, so a beat can be a little late
 * without being wrong about which beat it is.
 */
import {
  addTap,
  markDownbeat,
  moveBeat,
  removeBeat,
  replaceTaps,
  resetBeat,
  type TappedBeat
} from '../tappedBeats';

/** Beats at 120bpm, marked every `bar` if given. */
const tapped = (count: number, beatMs = 500, bar?: number): TappedBeat[] =>
  Array.from({ length: count }, (_, i) => ({
    atMs: i * beatMs,
    tappedAtMs: i * beatMs,
    isDownbeat: bar != null && i % bar === 0
  }));

describe('tapping the beat', () => {
  it('puts a beat exactly where the finger landed', () => {
    const beats = addTap(addTap([], 0), 507);
    expect(beats.map((b) => b.atMs)).toEqual([0, 507]);
  });

  it('reads a bouncing finger as one beat', () => {
    const beats = addTap(addTap([], 500), 540);
    expect(beats).toHaveLength(1);
  });

  it('keeps them in time order however they arrive', () => {
    // A tap made after scrubbing backwards belongs where it landed.
    expect(addTap(addTap([], 900), 100).map((b) => b.atMs)).toEqual([100, 900]);
  });
});

describe('correcting a tapped beat', () => {
  it('moves it, and remembers where the finger landed', () => {
    const moved = moveBeat(tapped(4), 1, 470);
    const beat = moved.find((b) => b.tappedAtMs === 500);
    expect(beat?.atMs).toBe(470);
    expect(beat?.tappedAtMs).toBe(500);
  });

  it('puts it back where it was tapped', () => {
    const moved = moveBeat(tapped(4), 1, 470);
    const index = moved.findIndex((b) => b.tappedAtMs === 500);
    expect(resetBeat(moved, index)[1].atMs).toBe(500);
  });

  it('never moves one before the recording began', () => {
    expect(moveBeat(tapped(4), 1, -900)[0].atMs).toBe(0);
  });

  it('leaves every other beat alone', () => {
    const moved = moveBeat(tapped(4), 1, 470);
    expect(moved.map((b) => b.tappedAtMs)).toEqual([0, 500, 1000, 1500]);
  });
});

describe('marking where a bar begins', () => {
  it('marks and unmarks one beat', () => {
    const marked = markDownbeat(tapped(4), 2, true);
    expect(marked[2].isDownbeat).toBe(true);
    expect(markDownbeat(marked, 2, false)[2].isDownbeat).toBe(false);
  });
});

describe('tapping the take again', () => {
  it('replaces what was tapped before rather than adding to it', () => {
    // Tapping a second time is a correction. Merging the passes would give
    // both readings at once, at a pulse nobody played.
    const fresh = tapped(3, 600);
    expect(replaceTaps(tapped(6, 300), fresh).map((b) => b.atMs)).toEqual([
      0, 600, 1200
    ]);
  });

  it('keeps a bar mark that a fresh tap landed on', () => {
    // Which beats begin bars is a separate statement from where the beats
    // are, and re-tapping the pulse does not retract it.
    const before = markDownbeat(tapped(4, 500), 2, true);
    expect(replaceTaps(before, tapped(4, 500))[2].isDownbeat).toBe(true);
  });

  it('drops a bar mark that nothing was tapped near', () => {
    const before = markDownbeat(tapped(4, 500), 1, true);
    expect(
      replaceTaps(before, tapped(3, 700)).filter((b) => b.isDownbeat)
    ).toEqual([]);
  });
});

describe('throwing a beat away', () => {
  it('removes the one flicked away and leaves the rest', () => {
    expect(removeBeat(tapped(4), 1).map((b) => b.atMs)).toEqual([0, 1000, 1500]);
  });
});
