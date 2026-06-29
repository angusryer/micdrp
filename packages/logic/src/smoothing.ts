/**
 * Clean a raw pitch stream before segmentation.
 *
 * Raw frame-by-frame detection is jittery: occasional octave jumps, isolated
 * wrong-note frames, and low-confidence blips. A median filter over the note
 * (MIDI) values removes single-frame outliers, and a clarity gate turns
 * low-confidence frames into rests. Pure and dependency-free; operates on the
 * same `PitchFrame` shape used throughout the pipeline.
 */

import type { PitchFrame } from './segmentation';

export interface SmoothOptions {
  /** Median window size in frames; forced odd, min 1. 1 disables the median. Default 5. */
  windowSize?: number;
  /** Treat frames below this clarity as unvoiced before filtering. Default 0. */
  minClarity?: number;
}

export function smoothPitch(
  frames: PitchFrame[],
  options: SmoothOptions = {}
): PitchFrame[] {
  const minClarity = options.minClarity ?? 0;
  let windowSize = options.windowSize ?? 5;
  if (windowSize < 1) {
    windowSize = 1;
  }
  if (windowSize % 2 === 0) {
    windowSize += 1;
  }
  const half = (windowSize - 1) / 2;

  // Clarity-gate the note values up front.
  const gated: (number | null)[] = frames.map((f) =>
    f.midi != null && f.clarity >= minClarity ? f.midi : null
  );

  const out: PitchFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];

    if (windowSize === 1) {
      const midi = gated[i];
      out.push(
        midi == null
          ? rest(f)
          : { timestampMs: f.timestampMs, midi, cents: f.cents, clarity: f.clarity }
      );
      continue;
    }

    const voiced: number[] = [];
    const lo = Math.max(0, i - half);
    const hi = Math.min(frames.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      const m = gated[j];
      if (m != null) {
        voiced.push(m);
      }
    }

    if (voiced.length === 0) {
      out.push(rest(f));
      continue;
    }

    voiced.sort((a, b) => a - b);
    const median = voiced[Math.floor((voiced.length - 1) / 2)];
    // Keep the original cents only when this frame already sat on the median note.
    const cents = gated[i] === median ? f.cents ?? 0 : 0;
    out.push({ timestampMs: f.timestampMs, midi: median, cents, clarity: f.clarity });
  }

  return out;
}

function rest(f: PitchFrame): PitchFrame {
  return { timestampMs: f.timestampMs, midi: null, cents: null, clarity: f.clarity };
}
