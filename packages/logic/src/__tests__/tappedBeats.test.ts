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
  downbeatsFromBeats,
  markDownbeat,
  moveBeat,
  resetBeat,
  tempoFromBeats,
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

  it('reads the tempo that was tapped', () => {
    expect(tempoFromBeats(tapped(8))?.bpm).toBeCloseTo(120, 6);
  });

  it('is not thrown by one late tap', () => {
    // Tapping along is played, not typed. The median holds where a mean
    // would be dragged.
    const beats = tapped(8);
    beats[4] = { ...beats[4], atMs: beats[4].atMs + 120 };
    expect(tempoFromBeats(beats)?.bpm).toBeCloseTo(120, 0);
  });

  it('says nothing about tempo from fewer than three beats', () => {
    // Two taps are an interval, not a tempo: nothing in them says whether it
    // would have happened again.
    expect(tempoFromBeats(tapped(2))).toBeNull();
    expect(tempoFromBeats([])).toBeNull();
  });

  it('trusts an even tapping more than a ragged one', () => {
    const ragged = tapped(8).map((beat, i) => ({
      ...beat,
      atMs: beat.atMs + (i % 2 === 0 ? 0 : 160)
    }));
    const steady = tempoFromBeats(tapped(8))?.confidence ?? 0;
    expect(tempoFromBeats(ragged)?.confidence ?? 1).toBeLessThan(steady);
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

  it('reads the bar length from what was marked', () => {
    expect(tempoFromBeats(tapped(9, 500, 3))?.beatsPerBar).toBe(3);
    expect(tempoFromBeats(tapped(9, 500, 4))?.beatsPerBar).toBe(4);
  });

  it('says nothing about bar length from a single mark', () => {
    // One mark says where a bar begins and nothing about how long one is.
    const once = markDownbeat(tapped(8), 0, true);
    expect(tempoFromBeats(once)?.beatsPerBar).toBeNull();
  });

  it('takes its phase from the first bar marked', () => {
    const beats = markDownbeat(markDownbeat(tapped(9), 1, true), 5, true);
    expect(tempoFromBeats(beats)?.offsetMs).toBe(500);
  });

  it('falls back to the first beat where no bar was marked', () => {
    expect(tempoFromBeats(tapped(8))?.offsetMs).toBe(0);
  });

  it('gives the moments a bar begins', () => {
    expect(downbeatsFromBeats(tapped(9, 500, 4))).toEqual([0, 2000, 4000]);
  });

  it('gives none where nothing was marked', () => {
    expect(downbeatsFromBeats(tapped(8))).toEqual([]);
  });
});
