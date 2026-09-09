/**
 * The beat a few taps anchor (INV-NOTES-236..241).
 *
 * Every test here asserts a tapped instant is still exactly where the finger
 * put it, because that is the one thing this must never trade away.
 */
import { timelineFromAnchors } from '../beatAnchors';
import { msToBeat } from '../beatTimeline';
import type { TappedBeat } from '../tappedBeats';

const tap = (atMs: number, isDownbeat = false): TappedBeat => ({
  atMs,
  tappedAtMs: atMs,
  isDownbeat
});

/** Taps at the running sum of these gaps, starting at `from`. */
const walk = (from: number, gaps: readonly number[]): TappedBeat[] => {
  const out = [tap(from)];
  let at = from;
  for (const gap of gaps) {
    at += gap;
    out.push(tap(at));
  }
  return out;
};

/** The instants of the beats a person actually tapped. */
const statedAt = (t: { beats: number[]; stated: boolean[] }): number[] =>
  t.beats.filter((_, i) => t.stated[i]);

describe('timelineFromAnchors', () => {
  it('is null with nothing tapped, so the detected grid stands', () => {
    expect(timelineFromAnchors([], 100, 10000)).toBeNull();
  });

  it('leaves every beat where the finger put it', () => {
    const taps = walk(1000, [600, 900, 610, 1800, 590]);
    const timeline = timelineFromAnchors(taps, 100, 6000)!;
    expect(statedAt(timeline)).toEqual(taps.map((t) => t.atMs));
  });

  it('fills a gap the tapping says was skipped', () => {
    // Tapped every beat at 600ms with one tap missed in the middle. The
    // long gap is three times its neighbours, so it holds three beats.
    const timeline = timelineFromAnchors(
      walk(0, [600, 600, 1800, 600, 600]),
      100,
      4200
    )!;
    expect(timeline.beats).toEqual([0, 600, 1200, 1800, 2400, 3000, 3600, 4200]);
    expect(timeline.stated).toEqual([
      true, true, true, false, false, true, true, true
    ]);
  });

  it('does not invent a beat inside a phrase that was stretched', () => {
    // A ritardando and back: every gap longer than the last, then shorter.
    // The reading still says 600ms, and each gap read against it alone
    // would round up and gain a beat nobody played.
    const taps = walk(0, [600, 660, 750, 850, 750, 640]);
    const timeline = timelineFromAnchors(taps, 100, 4250)!;
    expect(timeline.beats).toEqual(taps.map((t) => t.atMs));
    expect(timeline.stated.every((s) => s)).toBe(true);
    expect(timeline.suspectGaps).toEqual([]);
  });

  it('reads a tapped backbeat as two beats to the tap', () => {
    // Tapped every 1200ms against a 600ms reading: the taps are every
    // second beat, so a beat falls between each pair.
    const timeline = timelineFromAnchors(walk(0, [1200, 1200]), 100, 2400)!;
    expect(timeline.beats).toEqual([0, 600, 1200, 1800, 2400]);
    expect(timeline.stated).toEqual([true, false, true, false, true]);
  });

  it('never drops a tap for falling inside the reading’s beat', () => {
    // Two taps 90ms apart against a 600ms beat: still two beats.
    const timeline = timelineFromAnchors([tap(0), tap(90)], 100, 90)!;
    expect(statedAt(timeline)).toEqual([0, 90]);
  });

  it('holds one beat to a gap where nothing was read from the melody', () => {
    const timeline = timelineFromAnchors([tap(0), tap(1800)], 0, 1800)!;
    expect(timeline.beats).toEqual([0, 1800]);
    expect(timeline.stated.every((s) => s)).toBe(true);
  });

  it('carries the beat past the taps at the reading’s rate, as derived', () => {
    const timeline = timelineFromAnchors([tap(600), tap(1200)], 100, 2400)!;
    expect(timeline.beats).toEqual([0, 600, 1200, 1800, 2400]);
    expect(timeline.stated).toEqual([false, true, true, false, false]);
  });

  it('moves the bar marks with the beats prepended before them', () => {
    const timeline = timelineFromAnchors(
      [tap(1200, true), tap(1800)],
      100,
      1800
    )!;
    expect(timeline.beats).toEqual([0, 600, 1200, 1800]);
    expect(timeline.barStarts).toEqual([2]);
    expect(timeline.beats[timeline.barStarts[0]]).toBe(1200);
  });

  it('points at the gap it had to guess the length of', () => {
    const timeline = timelineFromAnchors(
      walk(0, [600, 600, 1800, 600, 600]),
      100,
      4200
    )!;
    // The skipped gap, and only that one: the rest needed no guess.
    expect(timeline.suspectGaps).toEqual([2]);
  });

  it('leaves the rest of the take alone when a tap is added mid-way', () => {
    const before = timelineFromAnchors(walk(0, [600, 600, 600]), 100, 1800)!;
    const after = timelineFromAnchors(
      [...walk(0, [600, 600, 600]), tap(900)],
      100,
      1800
    )!;
    expect(after.beats[0]).toBe(before.beats[0]);
    expect(after.beats[after.beats.length - 1]).toBe(
      before.beats[before.beats.length - 1]
    );
    expect(after.beats).toContain(900);
    expect(after.stated[after.beats.indexOf(900)]).toBe(true);
  });

  it('reads a moment inside a stretched beat as part of that beat', () => {
    const timeline = timelineFromAnchors(walk(0, [600, 900, 700]), 0, 2200)!;
    expect(timeline.beats).toEqual([0, 600, 1500, 2200]);
    // Beat one runs 600 to 1500, so halfway through it is beat 1.5 — not
    // beat two, which is where a constant tempo would have put it.
    expect(msToBeat(timeline, 1050)).toBeCloseTo(1.5, 6);
    expect(msToBeat(timeline, 1500)).toBeCloseTo(2, 6);
  });
});
