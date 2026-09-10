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

/**
 * Where a beat came from.
 *
 * 'tapped' and 'voiced' are both things a person did — a finger on the pad
 * and a sound in the take — and both anchor the timeline (INV-NOTES-242).
 * 'derived' is the app's account of a stretch nobody marked at all, and is
 * the only one of the three that is a guess (INV-NOTES-237).
 */
export type BeatKind = 'tapped' | 'voiced' | 'derived';

/** A beat a person put there, by finger or by mouth. */
export interface Anchor {
  atMs: number;
  isDownbeat: boolean;
  /** True where this came out of the take rather than off the pad. */
  isVoiced?: boolean;
}

export interface AnchoredTimeline extends BeatTimeline {
  /** Index i says what put beat i there. */
  kinds: BeatKind[];
}

/**
 * The beat the taps anchor and the reading fills.
 *
 * Null with nothing to anchor — the caller keeps the detected grid, which
 * is what a take nobody tapped has and goes on having (INV-NOTES-241).
 */
export function timelineFromAnchors(
  taps: readonly Anchor[],
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
  const kinds: BeatKind[] = [];
  const barStarts: number[] = [];
  const suspectGaps: number[] = [];

  for (let i = 0; i < anchors.length; i += 1) {
    if (anchors[i].isDownbeat) {
      barStarts.push(beats.length);
    }
    beats.push(anchors[i].atMs);
    kinds.push(anchors[i].isVoiced === true ? 'voiced' : 'tapped');

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
      kinds.push('derived');
    }
  }

  extend(beats, kinds, barStarts, outerMs(beats, detectedMs), durationMs);
  return { beats, barStarts, suspectGaps, isTapped: true, kinds };
}

/** One beat of the take, ready to be drawn. */
export interface DrawnBeat {
  atMs: number;
  /** What put it there: tapped, heard in the voice, or worked out. */
  kind: BeatKind;
  isDownbeat: boolean;
}

/**
 * Every beat, shaped for the thing that draws it.
 *
 * The three parallel arrays a timeline holds are the right shape for
 * arithmetic and the wrong one for a paint loop, which wants one beat at a
 * time and has to say which kind each is (INV-NOTES-237).
 */
export function drawnBeats(timeline: AnchoredTimeline): DrawnBeat[] {
  const bars = new Set(timeline.barStarts);
  return timeline.beats.map((atMs, i) => ({
    atMs,
    kind: timeline.kinds[i] ?? 'derived',
    isDownbeat: bars.has(i)
  }));
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
  kinds: BeatKind[],
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
    kinds.push('derived');
  }
  const before: number[] = [];
  for (let at = beats[0] - periodMs; at >= 0; at -= periodMs) {
    before.unshift(at);
  }
  if (before.length === 0) {
    return;
  }
  beats.unshift(...before);
  kinds.unshift(...before.map((): BeatKind => 'derived'));
  for (let i = 0; i < barStarts.length; i += 1) {
    barStarts[i] += before.length;
  }
}
