/**
 * Krumhansl-Schmuckler key/scale detection.
 *
 * Build a 12-bin pitch-class histogram weighted by note duration, then
 * correlate it against the 24 rotated major/minor K-S key profiles. The best
 * Pearson correlation wins; confidence is the gap to the runner-up, scaled.
 *
 * Pure, dependency-free, ES5-safe Math only (no `**` / Math.log2). Accepts the
 * upstream `PitchFrame[]` (per-frame analyses) or `NoteEvent[]` (segmented
 * notes); both contribute pitch-class weight, frames by frame-count and notes
 * by duration.
 */

import type { PitchFrame, NoteEvent } from './segmentation';
import { NOTE_NAMES } from './notes';

export type KeyMode = 'major' | 'minor';

export interface KeyEstimate {
  /** Tonic pitch class, 0 = C .. 11 = B. */
  tonic: number;
  /** Chromatic name of the tonic (e.g. 'C', 'F#'). */
  tonicName: string;
  /** Detected mode. */
  mode: KeyMode;
  /** 0..1 — separation of the winning profile from the runner-up. */
  confidence: number;
}

/**
 * Krumhansl-Kessler key profiles (major/minor), indexed from the tonic.
 * These are the canonical perceived-stability weights for each scale degree.
 */
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
];

function isNoteEvent(item: PitchFrame | NoteEvent): item is NoteEvent {
  return (
    typeof (item as NoteEvent).durationMs === 'number' &&
    typeof (item as PitchFrame).timestampMs !== 'number'
  );
}

/**
 * Accumulate a duration/count-weighted pitch-class histogram over the input.
 * Notes contribute their duration; frames contribute one unit each.
 */
function buildHistogram(frames: ReadonlyArray<PitchFrame | NoteEvent>): number[] {
  const histogram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < frames.length; i++) {
    const item = frames[i];

    let midi: number | null;
    let weight: number;

    if (isNoteEvent(item)) {
      midi = item.midi;
      weight = item.durationMs > 0 ? item.durationMs : 1;
    } else {
      midi = item.midi;
      weight = 1;
    }

    if (midi == null) {
      continue;
    }

    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
    histogram[pitchClass] += weight;
  }

  return histogram;
}

function mean(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Pearson correlation between a histogram and a profile rotated to `tonic`.
 * Returns a value in [-1, 1]; 0 when either series has no variance.
 */
function correlate(
  histogram: number[],
  histMean: number,
  profile: number[],
  profileMean: number,
  tonic: number
): number {
  let numerator = 0;
  let histVar = 0;
  let profVar = 0;

  for (let i = 0; i < 12; i++) {
    const h = histogram[i] - histMean;
    // Rotate the profile so its degree 0 lands on `tonic`.
    const p = profile[((i - tonic) % 12 + 12) % 12] - profileMean;
    numerator += h * p;
    histVar += h * h;
    profVar += p * p;
  }

  const denom = Math.sqrt(histVar * profVar);
  if (denom === 0) {
    return 0;
  }
  return numerator / denom;
}

/**
 * Detect the most likely key/scale of a sung passage.
 *
 * Empty/silent input resolves to C major with zero confidence.
 */
export function detectKey(
  frames: ReadonlyArray<PitchFrame | NoteEvent>
): KeyEstimate {
  const histogram = buildHistogram(frames);

  let total = 0;
  for (let i = 0; i < 12; i++) {
    total += histogram[i];
  }
  if (total === 0) {
    return { tonic: 0, tonicName: NOTE_NAMES[0], mode: 'major', confidence: 0 };
  }

  const histMean = mean(histogram);
  const majorMean = mean(MAJOR_PROFILE);
  const minorMean = mean(MINOR_PROFILE);

  let bestScore = -Infinity;
  let secondScore = -Infinity;
  let bestTonic = 0;
  let bestMode: KeyMode = 'major';

  for (let tonic = 0; tonic < 12; tonic++) {
    const majorScore = correlate(
      histogram,
      histMean,
      MAJOR_PROFILE,
      majorMean,
      tonic
    );
    const minorScore = correlate(
      histogram,
      histMean,
      MINOR_PROFILE,
      minorMean,
      tonic
    );

    if (majorScore > bestScore) {
      secondScore = bestScore;
      bestScore = majorScore;
      bestTonic = tonic;
      bestMode = 'major';
    } else if (majorScore > secondScore) {
      secondScore = majorScore;
    }

    if (minorScore > bestScore) {
      secondScore = bestScore;
      bestScore = minorScore;
      bestTonic = tonic;
      bestMode = 'minor';
    } else if (minorScore > secondScore) {
      secondScore = minorScore;
    }
  }

  // Confidence: how far the winner separates from the runner-up. Both scores
  // are correlations in [-1, 1]; clamp the normalized gap into [0, 1].
  let confidence = 0;
  if (bestScore > -Infinity && secondScore > -Infinity) {
    confidence = (bestScore - secondScore) / 2;
  }
  if (confidence < 0) {
    confidence = 0;
  } else if (confidence > 1) {
    confidence = 1;
  }

  return {
    tonic: bestTonic,
    tonicName: NOTE_NAMES[bestTonic],
    mode: bestMode,
    confidence
  };
}
