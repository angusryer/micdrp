/**
 * Score a sung take against a reference melody.
 *
 * Frame-level pitch scoring: for every voiced frame that overlaps a target
 * note, measure the cents error and aggregate into an in-tune ratio, a mean
 * cents error, and a smooth 0..100 score. Pure and dependency-free; the input
 * frame shape is the same `PitchFrame` produced upstream.
 */

import type { PitchFrame } from './segmentation';

/** A note in the reference melody, with absolute timing. */
export interface TargetNote {
  midi: number;
  startMs: number;
  endMs: number;
}

/**
 * Canonical cents tolerance for "in tune". `logic` owns this default because it
 * is a property of the scoring algorithm; every other layer (e.g. the client's
 * feedback synthesis) imports it from here rather than re-declaring the value.
 */
export const DEFAULT_TOLERANCE_CENTS = 50;

export interface ScoreOptions {
  /** Cents within which a frame counts as "in tune" (default {@link DEFAULT_TOLERANCE_CENTS}). */
  toleranceCents?: number;
  /** Match pitch class only, ignoring octave errors (default false). */
  ignoreOctave?: boolean;
}

export interface PitchScore {
  /** Overall 0..100 score (smoothly degrades with cents error). */
  score: number;
  /** Fraction of evaluated frames within tolerance, 0..1. */
  inTuneRatio: number;
  /** Mean absolute cents error over evaluated frames. */
  meanCentsError: number;
  /** Voiced frames that overlapped a target note and were scored. */
  evaluatedFrames: number;
}

/** A frame scores 0 once it is this many cents from the target. */
const ZERO_SCORE_CENTS = 200;

export function scorePitch(
  frames: PitchFrame[],
  targets: TargetNote[],
  options: ScoreOptions = {}
): PitchScore {
  const tolerance = options.toleranceCents ?? DEFAULT_TOLERANCE_CENTS;
  const ignoreOctave = options.ignoreOctave ?? false;

  let evaluated = 0;
  let inTune = 0;
  let sumAbsError = 0;
  let sumFrameScore = 0;

  for (const f of frames) {
    if (f.midi == null) {
      continue;
    }
    const target = findTarget(targets, f.timestampMs);
    if (target == null) {
      continue;
    }

    let error = (f.midi - target.midi) * 100 + (f.cents ?? 0);
    if (ignoreOctave) {
      error = octaveReduce(error);
    }
    const absError = Math.abs(error);

    evaluated++;
    sumAbsError += absError;
    if (absError <= tolerance) {
      inTune++;
    }
    sumFrameScore += absError >= ZERO_SCORE_CENTS ? 0 : 1 - absError / ZERO_SCORE_CENTS;
  }

  if (evaluated === 0) {
    return { score: 0, inTuneRatio: 0, meanCentsError: 0, evaluatedFrames: 0 };
  }

  return {
    score: Math.round((sumFrameScore / evaluated) * 100),
    inTuneRatio: inTune / evaluated,
    meanCentsError: sumAbsError / evaluated,
    evaluatedFrames: evaluated
  };
}

function findTarget(targets: TargetNote[], timeMs: number): TargetNote | null {
  for (const t of targets) {
    if (timeMs >= t.startMs && timeMs < t.endMs) {
      return t;
    }
  }
  return null;
}

/** Fold a cents error into the nearest octave, returning a value in (−600, 600]. */
function octaveReduce(cents: number): number {
  let c = cents % 1200;
  if (c > 600) {
    c -= 1200;
  } else if (c <= -600) {
    c += 1200;
  }
  return c;
}
