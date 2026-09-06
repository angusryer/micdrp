/**
 * What the taps were for (INV-NOTES-209).
 *
 * Tapping every beat of a song to establish its tempo is most of a
 * performance spent on bookkeeping. What actually gets tapped is two and
 * four, so that is what a take assumes — and a take tapped some other way is
 * told so afterwards rather than guessed at.
 *
 * This narrows INV-NOTES-161 rather than reversing it. That invariant was
 * written after a grid fitted to a handful of taps moved the bar lines and
 * re-cut the harmony of a take somebody was reading. The lesson was that the
 * app must not draw conclusions from marks, and it holds: nothing is
 * concluded here. The pattern is a sentence the singer says about their own
 * take, and the grid follows from the taps and that sentence together.
 */
import type { TappedBeat } from './tappedBeats';

/** Which beats of the bar the taps were meant for. */
export interface TapPattern {
  /** 1-based beats of the bar, ascending. At least one. */
  beats: readonly number[];
  /** How many beats a bar holds. */
  beatsPerBar: number;
}

/**
 * What a take assumes until somebody says otherwise.
 *
 * Two and four of four: the backbeat, which is what a hand does on its own
 * while the other half of you is singing.
 */
export const DEFAULT_TAP_PATTERN: TapPattern = { beats: [2, 4], beatsPerBar: 4 };

/** The patterns worth offering, in the order they are worth trying. */
export const TAP_PATTERNS: readonly TapPattern[] = [
  { beats: [2, 4], beatsPerBar: 4 },
  { beats: [1, 3], beatsPerBar: 4 },
  { beats: [1, 2, 3, 4], beatsPerBar: 4 },
  { beats: [1], beatsPerBar: 4 },
  { beats: [1, 2, 3], beatsPerBar: 3 },
  { beats: [1], beatsPerBar: 3 }
];

/** Two patterns describing the same thing. */
export function samePattern(a: TapPattern, b: TapPattern): boolean {
  return (
    a.beatsPerBar === b.beatsPerBar &&
    a.beats.length === b.beats.length &&
    a.beats.every((beat, i) => beat === b.beats[i])
  );
}

/** Whether a pattern says something a bar can actually hold. */
export function isUsablePattern(pattern: TapPattern): boolean {
  const { beats, beatsPerBar } = pattern;
  return (
    beatsPerBar > 0 &&
    beats.length > 0 &&
    beats.length <= beatsPerBar &&
    beats.every(
      (beat, i) =>
        Number.isInteger(beat) &&
        beat >= 1 &&
        beat <= beatsPerBar &&
        (i === 0 || beat > beats[i - 1])
    )
  );
}

/**
 * Which beat of the take each tap was meant for, counting from one.
 *
 * The taps cycle through the pattern: with two and four of four, the taps
 * are beats 2, 4, 6, 8 and so on. Counting this way rather than by a fixed
 * multiplier is what lets an uneven pattern work — beats one and two of four
 * is two taps close together and then a wait, and the positions say so.
 */
export function beatPositions(count: number, pattern: TapPattern): number[] {
  const { beats, beatsPerBar } = pattern;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const bar = Math.floor(i / beats.length);
    out.push(beats[i % beats.length] + bar * beatsPerBar);
  }
  return out;
}

/** What the taps and the pattern together say the grid is. */
export interface PatternedTempo {
  bpm: number;
  /** One beat, in ms. */
  beatMs: number;
  /** Where beat one of the first bar sits, which is a downbeat. */
  offsetMs: number;
  /** 0..1 — how evenly the taps sit on the grid the pattern implies. */
  confidence: number;
  beatsPerBar: number;
}

/** Two taps are the fewest that say anything about a rate. */
const MIN_TAPS = 2;

/**
 * The grid the taps describe, read through the pattern.
 *
 * A straight line through the taps against the beats they were meant for:
 * its slope is a beat, and where it crosses beat one is the downbeat. Least
 * squares rather than the first and last tap alone, so one late tap moves
 * the answer a little instead of all of it.
 *
 * Null where there is nothing to say — too few taps, or a pattern a bar
 * cannot hold. Null is a real answer and callers keep the grid they had.
 */
export function tempoFromPattern(
  beats: readonly TappedBeat[],
  pattern: TapPattern
): PatternedTempo | null {
  if (beats.length < MIN_TAPS || !isUsablePattern(pattern)) {
    return null;
  }
  const times = [...beats].map((beat) => beat.atMs).sort((a, b) => a - b);
  const positions = beatPositions(times.length, pattern);

  const n = times.length;
  const meanPos = positions.reduce((a, b) => a + b, 0) / n;
  const meanTime = times.reduce((a, b) => a + b, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i += 1) {
    const dp = positions[i] - meanPos;
    covariance += dp * (times[i] - meanTime);
    variance += dp * dp;
  }
  if (!(variance > 0)) {
    return null;
  }
  const beatMs = covariance / variance;
  if (!(beatMs > 0)) {
    return null;
  }
  const atBeatZero = meanTime - beatMs * meanPos;

  // How far each tap sits from where the pattern puts it, as a fraction of a
  // beat. The average miss, not the worst: one late tap is a late tap.
  let miss = 0;
  for (let i = 0; i < n; i += 1) {
    miss += Math.abs(times[i] - (atBeatZero + beatMs * positions[i])) / beatMs;
  }
  const error = miss / n;

  return {
    beatMs,
    bpm: 60000 / beatMs,
    // Beat one of the first bar, which is a downbeat — the taps may not have
    // landed on it, and with two and four they never do.
    offsetMs: atBeatZero + beatMs,
    confidence: Math.max(0, Math.min(1, 1 - error / 0.22)),
    beatsPerBar: pattern.beatsPerBar
  };
}
