/**
 * The beat of a take that breathes: taps as anchors, the reading in between.
 *
 * Tapping density is local. Somebody taps every beat through one phrase,
 * twice around an awkward bar, and not at all through the next — so one
 * period fitted across the take describes none of those stretches, and a
 * take with any push and pull in it fits nothing at all.
 *
 * So every gap between two taps is warped to its own pair of anchors
 * (INV-NOTES-236): the beats divide the gap evenly, and its ends land
 * exactly where the fingers did. Two anchors a second apart and two more a
 * second and a half apart keep both speeds, because neither gap knows about
 * the other. How many beats a gap holds is `beatSpans`, which is the only
 * thing here that is inferred rather than counted.
 *
 * A beat somebody tapped and a beat this placed are different claims, and
 * every beat says which it is (INV-NOTES-237). That is the whole licence
 * for filling a gap at all: INV-NOTES-200 refused to, and was right to
 * while a filled beat was indistinguishable from a stated one.
 */
import { beatsPerTap, spanOf } from './beatSpans';
import type { BeatTimeline } from './beatTimeline';
import type { TappedBeat } from './tappedBeats';

export interface AnchoredTimeline extends BeatTimeline {
  /** Index i is true where beat i is a tap rather than a fill. */
  stated: boolean[];
}

/**
 * The beat the taps anchor and the reading fills.
 *
 * Null with nothing to anchor — the caller keeps the detected grid, which
 * is what a take nobody tapped has and goes on having (INV-NOTES-241).
 */
export function timelineFromAnchors(
  taps: readonly TappedBeat[],
  detectedBpm: number,
  durationMs: number
): AnchoredTimeline | null {
  const anchors = [...taps].sort((a, b) => a.atMs - b.atMs);
  if (anchors.length === 0) {
    return null;
  }
  const detectedMs = detectedBpm > 0 ? 60000 / detectedBpm : 0;
  const gaps = anchors.slice(1).map((a, i) => a.atMs - anchors[i].atMs);
  const perTap = beatsPerTap(gaps, detectedMs);

  const beats: number[] = [];
  const stated: boolean[] = [];
  const barStarts: number[] = [];
  const suspectGaps: number[] = [];

  for (let i = 0; i < anchors.length; i += 1) {
    if (anchors[i].isDownbeat) {
      barStarts.push(beats.length);
    }
    beats.push(anchors[i].atMs);
    stated.push(true);

    if (i + 1 >= anchors.length) {
      continue;
    }
    const span = spanOf(gaps, i, perTap);
    // Pointed at wherever the fill had to decide how many (INV-NOTES-200).
    // Indexed by the beat the fill begins after, which is where a person
    // looking to correct it would put their finger.
    if (span > 1) {
      suspectGaps.push(beats.length - 1);
    }
    for (let k = 1; k < span; k += 1) {
      beats.push(anchors[i].atMs + (gaps[i] * k) / span);
      stated.push(false);
    }
  }

  extend(beats, stated, barStarts, outerMs(beats, detectedMs), durationMs);
  return { beats, barStarts, suspectGaps, isTapped: true, stated };
}

/**
 * The period the beat carries on at past the last tap and before the first.
 *
 * The reading's, where there is one: outside the anchors the reading is the
 * only evidence there is. Otherwise the pulse the taps were made at, which
 * is the only other thing anybody said.
 */
function outerMs(beats: readonly number[], detectedMs: number): number {
  if (detectedMs > 0) {
    return detectedMs;
  }
  if (beats.length < 2) {
    return 0;
  }
  return (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
}

/**
 * Carry the beat out to both ends of the take, all of it derived.
 *
 * Written in place, and the bar marks shift with it: prepending beats moves
 * every index that was already counted.
 */
function extend(
  beats: number[],
  stated: boolean[],
  barStarts: number[],
  periodMs: number,
  durationMs: number
): void {
  if (!(periodMs > 0) || beats.length === 0) {
    return;
  }
  const last = beats[beats.length - 1];
  for (let at = last + periodMs; at <= durationMs; at += periodMs) {
    beats.push(at);
    stated.push(false);
  }
  const before: number[] = [];
  for (let at = beats[0] - periodMs; at >= 0; at -= periodMs) {
    before.unshift(at);
  }
  if (before.length === 0) {
    return;
  }
  beats.unshift(...before);
  stated.unshift(...before.map(() => false));
  for (let i = 0; i < barStarts.length; i += 1) {
    barStarts[i] += before.length;
  }
}
