/**
 * INV-NOTES-131 — the grid a handful of taps implies.
 *
 * Taps are sparse. Somebody tapping along with their own singing catches the
 * beats they were sure of and misses the rest, and a feature that demanded all
 * of them would be a chore rather than a help. So the gaps between taps are
 * whole numbers of beats, not single beats, and the grid is fitted to them —
 * then the beats nobody tapped, and the bars, follow from the fit.
 */
import {
  beatsAcross,
  downbeatsFromBeats,
  tempoFromBeats
} from '../beatGrid';
import { markDownbeat, type TappedBeat } from '../tappedBeats';

/** Beats at 120bpm, marked every `bar` if given. */
const tapped = (count: number, beatMs = 500, bar?: number): TappedBeat[] =>
  Array.from({ length: count }, (_, i) => ({
    atMs: i * beatMs,
    tappedAtMs: i * beatMs,
    isDownbeat: bar != null && i % bar === 0
  }));

/** Taps at chosen moments, in ms. */
const at = (...msList: number[]): TappedBeat[] =>
  msList.map((ms) => ({ atMs: ms, tappedAtMs: ms, isDownbeat: false }));

describe('fitting a grid to taps', () => {
  it('reads the tempo of a beat tapped throughout', () => {
    expect(tempoFromBeats(tapped(8))?.bpm).toBeCloseTo(120, 6);
  });

  it('is not thrown by one late tap', () => {
    const beats = tapped(8);
    beats[4] = { ...beats[4], atMs: beats[4].atMs + 120 };
    expect(tempoFromBeats(beats)?.bpm).toBeCloseTo(120, 0);
  });

  it('says nothing from fewer than three taps', () => {
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
});

describe('taps that skip beats', () => {
  it('holds the tempo when a tap is missed in the middle', () => {
    // Beats at 500ms with the third one not caught. Read naively as adjacent
    // gaps this is 500, 1000, 500 — a tempo nobody played.
    expect(tempoFromBeats(at(0, 500, 1500, 2000))?.beatMs).toBeCloseTo(500, 6);
  });

  it('does not invent beats between taps that explain themselves', () => {
    // Every gap is one beat. A grid at half the period fits just as well and
    // would put a beat between each pair that nobody tapped.
    expect(tempoFromBeats(tapped(6))?.beatMs).toBeCloseTo(500, 6);
  });

  it('reads bar-length taps as bars once the tempo is known', () => {
    // Four taps two seconds apart. Alone they are a slow pulse; with the
    // melody heard at 120 they are the first beats of four bars.
    const bars = at(0, 2000, 4000, 6000);
    expect(tempoFromBeats(bars)?.bpm).toBeCloseTo(30, 0);
    expect(tempoFromBeats(bars, 120)?.bpm).toBeCloseTo(120, 0);
  });

  it('leaves a heard tempo alone when it is not a multiple of the taps', () => {
    // Only whole multiples and divisors. A heard tempo that is neither says
    // nothing about the tapped one and must not drag it.
    expect(tempoFromBeats(tapped(6), 137)?.beatMs).toBeCloseTo(500, 6);
  });

  it('refuses a pulse faster than anyone taps', () => {
    expect(tempoFromBeats(at(0, 40, 80, 120))).toBeNull();
  });
});

describe('the bars a grid implies', () => {
  it('reads the bar length from what was marked', () => {
    expect(tempoFromBeats(tapped(9, 500, 3))?.beatsPerBar).toBe(3);
    expect(tempoFromBeats(tapped(9, 500, 4))?.beatsPerBar).toBe(4);
  });

  it('reads it from two marks with nothing tapped between them', () => {
    // The marks are as sparse as everything else. Counted in taps this is a
    // bar of two; counted in beats of the fitted grid it is a bar of four.
    const sparse = markDownbeat(
      markDownbeat(at(0, 500, 2000, 2500, 4000), 0, true),
      2,
      true
    );
    expect(tempoFromBeats(sparse)?.beatsPerBar).toBe(4);
  });

  it('says nothing about bar length from a single mark', () => {
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
});

describe('the beats that follow from a grid', () => {
  const grid = tempoFromBeats(tapped(9, 500, 4));

  it('runs the length of the take, not the length of the tapping', () => {
    const beats = beatsAcross(tapped(9, 500, 4), grid!, 10000);
    expect(beats).toHaveLength(21);
    expect(beats[beats.length - 1].atMs).toBe(10000);
  });

  it('says which beats a person actually tapped', () => {
    const beats = beatsAcross(tapped(9, 500, 4), grid!, 10000);
    expect(beats.filter((b) => b.isTapped)).toHaveLength(9);
  });

  it('carries the bars past the last tap', () => {
    expect(downbeatsFromBeats(tapped(9, 500, 4), grid, 10000)).toEqual([
      0, 2000, 4000, 6000, 8000, 10000
    ]);
  });

  it('gives only what was marked when there is no grid to carry it', () => {
    expect(downbeatsFromBeats(tapped(9, 500, 4))).toEqual([0, 2000, 4000]);
  });

  it('gives no bars where nothing was marked', () => {
    const loose = tempoFromBeats(tapped(8));
    expect(downbeatsFromBeats(tapped(8), loose, 10000)).toEqual([]);
  });
});
