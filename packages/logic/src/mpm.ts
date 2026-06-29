/**
 * Monophonic pitch detection via the McLeod Pitch Method (MPM).
 *
 * MPM is well suited to singing: it computes the Normalized Square Difference
 * Function (NSDF) and picks the first "key maximum" above a clarity threshold,
 * which is robust to the strong harmonics of the human voice. The NSDF peak
 * value doubles as a clarity/confidence score (the "vocal clarity" metric the
 * product surfaces).
 *
 * This is a pure function over a frame of PCM samples — no audio-engine or RN
 * dependencies — so it runs unchanged in Jest, in a worklet, or (ported) in
 * C++ later.
 */

export interface PitchResult {
  /** Detected fundamental frequency in Hz, or null if none was confident. */
  frequency: number | null;
  /** NSDF clarity at the chosen peak, in [0, 1]. */
  clarity: number;
}

export interface MpmOptions {
  /**
   * Fraction (0..1) of the highest NSDF peak a key maximum must reach to be
   * accepted. Higher = stricter. Default 0.9.
   */
  clarityThreshold?: number;
  /** Reject detections below this frequency (Hz). */
  minFrequency?: number;
  /** Reject detections above this frequency (Hz). */
  maxFrequency?: number;
}

const EMPTY: PitchResult = { frequency: null, clarity: 0 };

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  options: MpmOptions = {}
): PitchResult {
  const threshold = options.clarityThreshold ?? 0.9;
  const n = samples.length;
  if (n < 4 || sampleRate <= 0) {
    return EMPTY;
  }

  // Normalized Square Difference Function (NSDF), type-II autocorrelation.
  const nsdf = new Float32Array(n);
  for (let tau = 0; tau < n; tau++) {
    let acf = 0; // autocorrelation at lag tau
    let div = 0; // sum of squares of both windows (m'(tau))
    for (let i = 0; i < n - tau; i++) {
      const a = samples[i];
      const b = samples[i + tau];
      acf += a * b;
      div += a * a + b * b;
    }
    nsdf[tau] = div > 0 ? (2 * acf) / div : 0;
  }

  // Collect the maximum of each positive "hump" after the lag-0 lobe.
  const maxPositions: number[] = [];
  let i = 0;
  // Skip the initial positive lobe around lag 0.
  while (i < n - 1 && nsdf[i] > 0) {
    i++;
  }
  while (i < n - 1) {
    // Advance to the next positive region.
    while (i < n - 1 && nsdf[i] <= 0) {
      i++;
    }
    if (i >= n - 1) {
      break;
    }
    // Track the local maximum within this positive region.
    let localMax = -Infinity;
    let localMaxIdx = i;
    while (i < n - 1 && nsdf[i] > 0) {
      if (nsdf[i] > localMax) {
        localMax = nsdf[i];
        localMaxIdx = i;
      }
      i++;
    }
    maxPositions.push(localMaxIdx);
  }

  if (maxPositions.length === 0) {
    return EMPTY;
  }

  // Highest peak sets the acceptance cutoff.
  let highest = 0;
  for (let k = 0; k < maxPositions.length; k++) {
    const v = nsdf[maxPositions[k]];
    if (v > highest) {
      highest = v;
    }
  }
  if (highest <= 0) {
    return EMPTY;
  }

  const cutoff = threshold * highest;

  // First key maximum at or above the cutoff wins.
  for (let k = 0; k < maxPositions.length; k++) {
    const p = maxPositions[k];
    if (nsdf[p] < cutoff) {
      continue;
    }

    // Parabolic interpolation around the integer peak for sub-sample accuracy.
    let peakTau = p;
    let peakValue = nsdf[p];
    if (p > 0 && p < n - 1) {
      const s0 = nsdf[p - 1];
      const s1 = nsdf[p];
      const s2 = nsdf[p + 1];
      const denom = s0 + s2 - 2 * s1;
      if (denom !== 0) {
        const delta = (0.5 * (s0 - s2)) / denom;
        peakTau = p + delta;
        peakValue = s1 - 0.25 * (s0 - s2) * delta;
      }
    }

    if (peakTau <= 0) {
      return { frequency: null, clarity: clamp01(peakValue) };
    }

    const frequency = sampleRate / peakTau;
    if (options.minFrequency != null && frequency < options.minFrequency) {
      return { frequency: null, clarity: clamp01(peakValue) };
    }
    if (options.maxFrequency != null && frequency > options.maxFrequency) {
      return { frequency: null, clarity: clamp01(peakValue) };
    }
    return { frequency, clarity: clamp01(peakValue) };
  }

  return { frequency: null, clarity: clamp01(highest) };
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
