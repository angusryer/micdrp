/**
 * Tempo estimation from note onsets.
 *
 * Vocal takes have no click track, so we infer tempo from the rhythm of sung
 * note onsets. We histogram inter-onset intervals (IOIs), fold them to a base
 * beat period, and pick the period whose multiples best explain the observed
 * onsets (a lightweight autocorrelation over candidate beat grids). The result
 * is clamped to a sane vocal range (40..240 bpm).
 *
 * Pure, dependency-free, ES5-safe Math only.
 */

import type { NoteEvent } from './segmentation';

export interface TempoEstimate {
  /** Beats per minute, clamped to [40, 240]. */
  bpm: number;
  /** 0..1 — fraction of onsets explained by the chosen beat grid. */
  confidence: number;
}

const MIN_BPM = 40;
const MAX_BPM = 240;

/** Beat period bounds in ms, derived from the bpm clamp. */
const MAX_PERIOD_MS = 60000 / MIN_BPM; // 1500ms (40 bpm)
const MIN_PERIOD_MS = 60000 / MAX_BPM; // 250ms (240 bpm)

function bpmToPeriod(bpm: number): number {
  return 60000 / bpm;
}

function periodToBpm(periodMs: number): number {
  return 60000 / periodMs;
}

function clampBpm(bpm: number): number {
  if (bpm < MIN_BPM) {
    return MIN_BPM;
  }
  if (bpm > MAX_BPM) {
    return MAX_BPM;
  }
  return bpm;
}

/**
 * Score a candidate beat period: how well do the onsets line up with a grid of
 * that period? For each onset we measure its phase error to the nearest grid
 * line (normalized to [0, 0.5]) and reward small errors. The mean reward over
 * all onsets is the period's score in [0, 1].
 */
function scorePeriod(onsets: number[], periodMs: number): number {
  if (periodMs <= 0 || onsets.length === 0) {
    return 0;
  }

  let rewardSum = 0;
  for (const onset of onsets) {
    const phase = onset / periodMs;
    const frac = phase - Math.floor(phase);
    // Distance to the nearest grid line, in [0, 0.5].
    const dist = frac > 0.5 ? 1 - frac : frac;
    // Linear reward: 1 when on a grid line, 0 when maximally off-grid.
    rewardSum += 1 - dist / 0.5;
  }

  return rewardSum / onsets.length;
}

/**
 * Estimate tempo from a list of segmented notes.
 *
 * Fewer than two onsets carries no rhythmic information, so we return a neutral
 * 0 bpm with zero confidence.
 */
export function estimateTempo(notes: readonly NoteEvent[]): TempoEstimate {
  // Collect and sort onsets.
  const onsets: number[] = [];
  for (const n of notes) {
    onsets.push(n.startMs);
  }
  onsets.sort(function (a, b) {
    return a - b;
  });

  if (onsets.length < 2) {
    return { bpm: 0, confidence: 0 };
  }

  // Seed candidate periods from the inter-onset intervals: real beat periods
  // tend to be an IOI or a small-integer fraction of one.
  const candidates: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const ioi = onsets[i] - onsets[i - 1];
    if (ioi <= 0) {
      continue;
    }
    // Fold the IOI and its sub-/super-divisions into the valid period band.
    for (const divisor of [1, 2, 3, 4]) {
      const period = ioi / divisor;
      if (period >= MIN_PERIOD_MS && period <= MAX_PERIOD_MS) {
        candidates.push(period);
      }
    }
  }

  if (candidates.length === 0) {
    return { bpm: 0, confidence: 0 };
  }

  // Evaluate every candidate period against the full onset grid and keep the
  // best. Ties favour the slower (longer-period) tempo, which is the musically
  // conventional choice over its faster harmonics.
  let bestScore = -Infinity;
  let bestPeriod = candidates[0];

  for (const period of candidates) {
    const score = scorePeriod(onsets, period);
    if (
      score > bestScore ||
      (score === bestScore && period > bestPeriod)
    ) {
      bestScore = score;
      bestPeriod = period;
    }
  }

  const bpm = clampBpm(periodToBpm(bestPeriod));

  let confidence = bestScore;
  if (confidence < 0) {
    confidence = 0;
  } else if (confidence > 1) {
    confidence = 1;
  }

  return { bpm: Math.round(bpm), confidence };
}

export { MIN_BPM, MAX_BPM, bpmToPeriod };
