/**
 * The beat as the person who sang it stated it.
 *
 * INV-NOTES-198 (a tap is one beat), INV-NOTES-199 (bars are counted),
 * INV-NOTES-200 (an odd gap is pointed at), INV-NOTES-201 (the tempo is a
 * range).
 */
import {
  beatToMs,
  countedBars,
  countedMetre,
  msToBeat,
  tappedTempo,
  timelineFromTaps
} from '../beatTimeline';
import type { TappedBeat } from '../tappedBeats';

const taps = (at: readonly number[], downbeats: readonly number[] = []): TappedBeat[] =>
  at.map((atMs, i) => ({
    atMs,
    tappedAtMs: atMs,
    isDownbeat: downbeats.includes(i)
  }));

/** A pulse that slows through the take, as a person singing actually does. */
const rubato = [0, 500, 1000, 1560, 2180, 2860];

describe('a tap is one beat', () => {
  it('INV-NOTES-198: makes as many beats as there were taps', () => {
    expect(timelineFromTaps(taps(rubato))?.beats).toHaveLength(6);
  });

  it('keeps the intervals as they were played', () => {
    // A fitted period would report one tempo here. The point of this model
    // is that slowing to land a note is playing, not error.
    const t = timelineFromTaps(taps(rubato));
    expect(t?.beats).toEqual(rubato);
  });

  it('is nothing at all from one or two taps', () => {
    // Two taps are an interval, and nothing in them says whether it would
    // have happened again.
    expect(timelineFromTaps(taps([0]))).toBeNull();
    expect(timelineFromTaps(taps([0, 500]))).toBeNull();
  });

  it('takes taps in time order however they were made', () => {
    // A tap made after scrubbing backwards belongs where it landed.
    expect(timelineFromTaps(taps([1000, 0, 500]))?.beats).toEqual([0, 500, 1000]);
  });
});

describe('where a moment sits', () => {
  it('reads a beat as long as it actually lasted', () => {
    const t = timelineFromTaps(taps(rubato))!;
    expect(msToBeat(t, 500)).toBeCloseTo(1, 6);
    // 1280ms sits halfway through the 560ms interval from beat 2 to beat 3.
    // Under a constant tempo taken from the opening it would read as 2.56.
    expect(msToBeat(t, 1280)).toBeCloseTo(2.5, 6);
  });

  it('comes back to where it started', () => {
    const t = timelineFromTaps(taps(rubato))!;
    for (const ms of [0, 250, 1280, 2500, 2860]) {
      expect(beatToMs(t, msToBeat(t, ms))).toBeCloseTo(ms, 6);
    }
  });

  it('carries on at the speed of the nearest interval outside the taps', () => {
    // The person stopped tapping; they did not state a tempo for the rest.
    const t = timelineFromTaps(taps(rubato))!;
    expect(msToBeat(t, 3540)).toBeCloseTo(6, 6);
    expect(msToBeat(t, -250)).toBeCloseTo(-0.5, 6);
  });
});

describe('bars are counted, not fitted', () => {
  it('INV-NOTES-199: reports unequal bars as unequal', () => {
    // 4, 4 and 3. Three half notes meant as a bar of four are six beats to
    // any arithmetic, and only the person who sang them knows.
    const at = Array.from({ length: 12 }, (_, i) => i * 500);
    const bars = countedBars(timelineFromTaps(taps(at, [0, 4, 8]))!);
    expect(bars.map((b) => b.beatCount)).toEqual([4, 4, 4]);
    expect(countedMetre(timelineFromTaps(taps(at, [0, 4, 8]))!)).toBe(4);
  });

  it('names no metre when the bars disagree', () => {
    const at = Array.from({ length: 11 }, (_, i) => i * 500);
    const t = timelineFromTaps(taps(at, [0, 4, 7]))!;
    expect(countedBars(t).map((b) => b.beatCount)).toEqual([4, 3, 4]);
    expect(countedMetre(t)).toBeNull();
  });

  it('treats beats before the first downbeat as a pickup', () => {
    const at = Array.from({ length: 10 }, (_, i) => i * 500);
    const bars = countedBars(timelineFromTaps(taps(at, [2, 6]))!);
    expect(bars[0]).toMatchObject({ index: 0, beatCount: 2, isPartial: true });
    expect(bars[1]).toMatchObject({ index: 1, beatCount: 4 });
  });

  it('has no bars at all until a downbeat is marked', () => {
    // One mark says where a bar begins and nothing about how long one is.
    expect(countedBars(timelineFromTaps(taps(rubato))!)).toEqual([]);
    expect(countedMetre(timelineFromTaps(taps(rubato))!)).toBeNull();
  });
});

describe('an odd gap', () => {
  it('INV-NOTES-200: is pointed at', () => {
    const t = timelineFromTaps(taps([0, 500, 1000, 2000, 2500, 3000]))!;
    expect(t.suspectGaps).toEqual([2]);
  });

  it('changes nothing about the timeline it appears in', () => {
    const at = [0, 500, 1000, 2000, 2500, 3000];
    const t = timelineFromTaps(taps(at))!;
    // No beat inserted, no bar renumbered, no count changed.
    expect(t.beats).toEqual(at);
    expect(msToBeat(t, 1500)).toBeCloseTo(2.5, 6);
  });

  it('does not cry foul over a pulse that is merely moving', () => {
    // A passage that slows steadily has no single odd gap in it.
    expect(timelineFromTaps(taps(rubato))?.suspectGaps).toEqual([]);
  });
});

describe('the tapped tempo', () => {
  it('INV-NOTES-201: is a middle and two edges', () => {
    const t = tappedTempo(timelineFromTaps(taps(rubato))!)!;
    // Intervals 500, 500, 560, 620, 680 → median 560.
    expect(t.medianBpm).toBeCloseTo(60000 / 560, 6);
    expect(t.slowestBpm).toBeCloseTo(60000 / 680, 6);
    expect(t.fastestBpm).toBeCloseTo(60000 / 500, 6);
  });

  it('collapses to one figure when the pulse did not move', () => {
    const t = tappedTempo(timelineFromTaps(taps([0, 500, 1000, 1500]))!)!;
    expect(t.medianBpm).toBeCloseTo(120, 6);
    expect(t.slowestBpm).toBeCloseTo(120, 6);
    expect(t.fastestBpm).toBeCloseTo(120, 6);
  });
});
