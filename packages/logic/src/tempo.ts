/**
 * Tempo and pulse estimation from note onsets.
 *
 * Vocal takes have no click track, so tempo is inferred from the rhythm of
 * sung note onsets.
 *
 * The previous implementation scored a candidate period by measuring each
 * onset's distance to the nearest grid line of `onset / period` — a grid
 * pinned to t = 0. Real takes never start at t = 0: the singer taps record,
 * breathes, and begins. A take that started half a beat late therefore fit the
 * HALF-period grid better than the true one, and reported double tempo with
 * high confidence. With no preference for humanly plausible tempi, a melody
 * sung in eighth notes doubled as well.
 *
 * Both are fixed by fitting the phase instead of assuming it, and by judging
 * candidate tempi against a perceptual prior.
 *
 * Phase comes from circular statistics. Map each onset's position within a
 * candidate period onto a circle and average the unit vectors: the resultant
 * vector's LENGTH says how tightly the onsets cluster at one phase, and its
 * ANGLE is that phase. Uniformly scattered onsets give roughly 1/sqrt(n)
 * whatever the period, so unlike a distance-to-grid score there is no
 * systematic bias toward short periods.
 *
 * Two properties of that measure do the rest of the work. A grid finer than
 * the true pulse still scores well (every onset on the beat is also on the
 * half-beat), while a grid COARSER than the pulse scores near zero (onsets
 * land on alternating sides of it). So the true pulse is the LONGEST period
 * that still scores well — which is what `fitPulse` returns. Turning that
 * pulse into a beat is then a question of which multiple of it a human would
 * tap along to, and that is what the tempo prior decides.
 *
 * Pure, dependency-free, ES5-safe Math only.
 */

import type { NoteEvent } from './segmentation';

export interface TempoEstimate {
  /** Beats per minute, clamped to [40, 240]. */
  bpm: number;
  /** 0..1 — how tightly the onsets cluster on the chosen beat grid. */
  confidence: number;
  /** Time of the first beat line in ms: the grid's phase, not always zero. */
  offsetMs: number;
}

export interface PulseFit {
  /** The finest regular pulse the onsets sit on, in ms. */
  periodMs: number;
  /** Time of the first pulse line, in ms. */
  offsetMs: number;
  /** 0..1 clustering strength at that period. */
  strength: number;
}

const MIN_BPM = 40;
const MAX_BPM = 240;

/** Beat period bounds in ms, derived from the bpm clamp. */
const MAX_PERIOD_MS = 60000 / MIN_BPM; // 1500ms (40 bpm)
const MIN_PERIOD_MS = 60000 / MAX_BPM; // 250ms (240 bpm)

/**
 * The pulse being searched for may be a subdivision, so the search runs well
 * below the slowest beat: 80ms is a sixteenth at 187 bpm.
 */
const MIN_PULSE_MS = 80;
const MAX_PULSE_MS = MAX_PERIOD_MS;

/** Geometric sweep step. 1.0015 resolves a period to about a tenth of a percent. */
const SWEEP_RATIO = 1.0015;
/** Width of the local refinement window around the coarse winner. */
const REFINE_SPAN = 1.004;
const REFINE_STEPS = 64;

/**
 * A finer grid always fits at least as well as the true pulse, so the outright
 * maximum would drift toward the shortest period tested. Accept the longest
 * period scoring within a whisker of the best.
 */
const SUBHARMONIC_TOLERANCE = 0.97;

/** How many pulses might make up one beat. */
const PULSES_PER_BEAT = [1, 2, 3, 4, 6];

/**
 * Moelants' resonance model: people most readily hear tempo around 100-120 bpm,
 * and hear a multiple of a true tempo AS that tempo. This prior is what
 * corrects a doubled reading, rather than a hard rule about a bpm threshold.
 */
const PREFERRED_BPM = 105;
const TEMPO_LOG_SIGMA = 0.6;

/** Compound metre is real but much rarer; it has to earn the reading. */
const TERNARY_PENALTY = 0.85;

/**
 * ln of the effective number of independent candidate periods in the sweep,
 * measured by running the fit over random onsets. Sets the chance level that
 * a reported confidence has to clear.
 */
const EFFECTIVE_LOG_CANDIDATES = 5.5;

/**
 * Ceiling on the modelled chance level.
 *
 * sqrt(ln m / n) is an asymptotic approximation and it exceeds 1 below about
 * six onsets, which made confidence collapse to zero for short takes: a
 * perfectly even four-note arpeggio reported the correct tempo at 0.000
 * confidence, and callers that gate on confidence threw a right answer away.
 *
 * Measured over random onsets the true chance level never reaches 1 — it is
 * 0.958 at four onsets and 0.910 at five — while a genuinely even take scores
 * essentially 1.000. Capping here keeps that last sliver of discrimination
 * instead of flattening it. Confidence at three or four onsets is inherently
 * a weak signal and should be read as such, but it is not nothing.
 */
const CHANCE_CEILING = 0.95;

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
 * Mean resultant vector of the onsets' phases within `periodMs`.
 *
 * Returns clustering strength in [0, 1] and the phase, in ms, at which the
 * onsets cluster.
 */
function resultant(
  onsets: readonly number[],
  weights: readonly number[],
  periodMs: number
): { strength: number; offsetMs: number } {
  if (periodMs <= 0 || onsets.length === 0) {
    return { strength: 0, offsetMs: 0 };
  }
  const turn = 2 * Math.PI;
  let cosSum = 0;
  let sinSum = 0;
  let total = 0;
  for (let i = 0; i < onsets.length; i++) {
    let position = onsets[i] % periodMs;
    if (position < 0) {
      position += periodMs;
    }
    const angle = (turn * position) / periodMs;
    const weight = weights[i];
    cosSum += weight * Math.cos(angle);
    sinSum += weight * Math.sin(angle);
    total += weight;
  }
  if (total <= 0) {
    return { strength: 0, offsetMs: 0 };
  }
  const strength = Math.sqrt(cosSum * cosSum + sinSum * sinSum) / total;
  let offsetMs = (Math.atan2(sinSum, cosSum) / turn) * periodMs;
  if (offsetMs < 0) {
    offsetMs += periodMs;
  }
  return { strength: strength, offsetMs: offsetMs };
}

/**
 * Calibrate a raw clustering strength into a confidence.
 *
 * The strength is the best of roughly two thousand candidate periods, and
 * taking the maximum of any statistic over many candidates inflates it: eight
 * onsets placed at random still score about 0.79, because with so few points
 * some period always happens to line them up. Reporting that as confidence
 * would mean a shapeless take claiming to be firmly in tempo.
 *
 * Measured over random onsets, that chance level tracks sqrt(ln(m) / n) with
 * an effective m of about 150 — the candidate periods are far from
 * independent, so the effective count is much smaller than the number swept.
 * Confidence is how far the observed strength clears that chance level.
 */
export function calibrateConfidence(strength: number, effectiveCount: number): number {
  if (effectiveCount < 2) {
    return 0;
  }
  const chance = Math.min(
    Math.sqrt(EFFECTIVE_LOG_CANDIDATES / effectiveCount),
    CHANCE_CEILING
  );
  if (chance >= 1) {
    return 0;
  }
  const cleared = (strength - chance) / (1 - chance);
  if (cleared < 0) {
    return 0;
  }
  if (cleared > 1) {
    return 1;
  }
  return cleared;
}

/**
 * How many onsets the weighting is really worth: (sum w)^2 / sum w^2. A take
 * dominated by one very long note carries less rhythmic evidence than its
 * onset count suggests.
 */
export function effectiveCount(weights: readonly number[]): number {
  let sum = 0;
  let sumSquares = 0;
  for (const weight of weights) {
    sum += weight;
    sumSquares += weight * weight;
  }
  return sumSquares > 0 ? (sum * sum) / sumSquares : 0;
}

/** Log-normal preference for humanly natural tempi. */
function tempoPrior(bpm: number): number {
  const ratio = Math.log(bpm / PREFERRED_BPM) / TEMPO_LOG_SIGMA;
  return Math.exp(-0.5 * ratio * ratio);
}

/**
 * Find the finest regular pulse the onsets sit on, with its phase.
 *
 * Exported because quantization needs the pulse and its phase, not just a bpm,
 * and re-running the sweep would be wasteful.
 */
export function fitPulse(
  onsets: readonly number[],
  weights?: readonly number[]
): PulseFit {
  if (onsets.length < 2) {
    return { periodMs: bpmToPeriod(PREFERRED_BPM), offsetMs: 0, strength: 0 };
  }
  const w: number[] = [];
  for (let i = 0; i < onsets.length; i++) {
    w.push(weights && weights[i] > 0 ? weights[i] : 1);
  }

  // Coarse geometric sweep.
  const periods: number[] = [];
  const scores: number[] = [];
  let best = 0;
  for (let p = MIN_PULSE_MS; p <= MAX_PULSE_MS; p *= SWEEP_RATIO) {
    const score = resultant(onsets, w, p).strength;
    periods.push(p);
    scores.push(score);
    if (score > best) {
      best = score;
    }
  }
  if (best <= 0) {
    return { periodMs: bpmToPeriod(PREFERRED_BPM), offsetMs: 0, strength: 0 };
  }

  // The longest period that is nearly as good as the best one.
  let chosen = periods[0];
  const floor = best * SUBHARMONIC_TOLERANCE;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (scores[i] >= floor) {
      chosen = periods[i];
      break;
    }
  }

  // Refine locally — the sweep only resolves to a tenth of a percent, and a
  // small period error accumulates into a large phase error across a phrase.
  const low = chosen / REFINE_SPAN;
  const high = chosen * REFINE_SPAN;
  let bestPeriod = chosen;
  let bestScore = -1;
  for (let i = 0; i <= REFINE_STEPS; i++) {
    const p = low + ((high - low) * i) / REFINE_STEPS;
    const score = resultant(onsets, w, p).strength;
    if (score > bestScore) {
      bestScore = score;
      bestPeriod = p;
    }
  }

  const fit = resultant(onsets, w, bestPeriod);
  return refineByRegression(onsets, w, bestPeriod, fit.offsetMs);
}

/**
 * Least-squares refit of the pulse against the grid line each onset landed on.
 *
 * The sweep resolves a period only to a fraction of a percent, and a period
 * error does not stay small: it accumulates as drift, so a grid that looks
 * right at the start of a phrase is a sixteenth note out by the end of a long
 * take. Assigning each onset to its nearest grid index and fitting
 * `t = offset + period * index` removes that drift, because every onset
 * constrains the period in proportion to how far into the take it sits.
 *
 * Repeated a few times so an onset initially assigned to the wrong grid line
 * can be reassigned once the fit improves.
 */
function refineByRegression(
  onsets: readonly number[],
  weights: readonly number[],
  seedPeriodMs: number,
  seedOffsetMs: number
): PulseFit {
  let periodMs = seedPeriodMs;
  let offsetMs = seedOffsetMs;

  for (let pass = 0; pass < 3; pass++) {
    let sumW = 0;
    let sumK = 0;
    let sumT = 0;
    let sumKK = 0;
    let sumKT = 0;
    for (let i = 0; i < onsets.length; i++) {
      const index = Math.round((onsets[i] - offsetMs) / periodMs);
      const predicted = offsetMs + index * periodMs;
      // An onset more than a third of a pulse from any grid line is not
      // evidence about where the grid is; including it would drag the fit.
      if (Math.abs(onsets[i] - predicted) > periodMs / 3) {
        continue;
      }
      const weight = weights[i];
      sumW += weight;
      sumK += weight * index;
      sumT += weight * onsets[i];
      sumKK += weight * index * index;
      sumKT += weight * index * onsets[i];
    }
    const denominator = sumW * sumKK - sumK * sumK;
    if (sumW <= 0 || Math.abs(denominator) < 1e-9) {
      break;
    }
    const nextPeriod = (sumW * sumKT - sumK * sumT) / denominator;
    if (!(nextPeriod > MIN_PULSE_MS && nextPeriod < MAX_PULSE_MS)) {
      break;
    }
    periodMs = nextPeriod;
    offsetMs = (sumT - periodMs * sumK) / sumW;
  }

  // Report the phase as a position within one pulse.
  let phase = offsetMs % periodMs;
  if (phase < 0) {
    phase += periodMs;
  }
  const strength = resultant(onsets, weights, periodMs).strength;
  return { periodMs: periodMs, offsetMs: phase, strength: strength };
}

/**
 * How many pulses make up one beat, and whether that implies compound metre.
 *
 * A pulse of 333ms could be read as 180 bpm, 90 bpm or 60 bpm; only one of
 * those is a tempo anyone actually taps along to, and the prior picks it.
 */
export function choosePulsesPerBeat(pulseMs: number): {
  pulsesPerBeat: number;
  isCompound: boolean;
} {
  let bestMultiple = 1;
  let bestScore = -1;
  for (const multiple of PULSES_PER_BEAT) {
    const periodMs = pulseMs * multiple;
    const bpm = periodToBpm(periodMs);
    if (bpm < MIN_BPM || bpm > MAX_BPM) {
      continue;
    }
    const ternary = multiple === 3 || multiple === 6 ? TERNARY_PENALTY : 1;
    const score = tempoPrior(bpm) * ternary;
    if (score > bestScore) {
      bestScore = score;
      bestMultiple = multiple;
    }
  }
  return {
    pulsesPerBeat: bestMultiple,
    isCompound: bestMultiple === 3 || bestMultiple === 6
  };
}

/** Onsets, sorted, with a weight per onset favouring longer notes. */
function onsetsOf(notes: readonly NoteEvent[]): {
  onsets: number[];
  weights: number[];
} {
  const sorted = notes.slice().sort(function (a, b) {
    return a.startMs - b.startMs;
  });
  const onsets: number[] = [];
  const weights: number[] = [];
  for (const event of sorted) {
    onsets.push(event.startMs);
    // Longer notes are stronger metrical evidence, but only mildly so.
    weights.push(Math.sqrt(Math.max(event.durationMs, 1)));
  }
  return { onsets: onsets, weights: weights };
}

/**
 * Estimate tempo from a list of segmented notes.
 *
 * Fewer than two onsets carries no rhythmic information, so we return a
 * neutral 0 bpm with zero confidence.
 */
export function estimateTempo(notes: readonly NoteEvent[]): TempoEstimate {
  if (notes.length < 2) {
    return { bpm: 0, confidence: 0, offsetMs: 0 };
  }
  const collected = onsetsOf(notes);
  const pulse = fitPulse(collected.onsets, collected.weights);
  const beat = choosePulsesPerBeat(pulse.periodMs);
  const beatMs = pulse.periodMs * beat.pulsesPerBeat;

  // The beat grid's phase is the pulse phase — every pulse line is a candidate
  // beat line, and which of them is "beat one" is a question of metre, not
  // tempo. Reported modulo the beat so it names a position within one beat.
  let offsetMs = pulse.offsetMs % beatMs;
  if (offsetMs < 0) {
    offsetMs += beatMs;
  }

  return {
    bpm: Math.round(clampBpm(periodToBpm(beatMs))),
    confidence: calibrateConfidence(pulse.strength, effectiveCount(collected.weights)),
    offsetMs: Math.round(offsetMs)
  };
}

export { MIN_BPM, MAX_BPM, MIN_PERIOD_MS, MAX_PERIOD_MS, bpmToPeriod, periodToBpm };
