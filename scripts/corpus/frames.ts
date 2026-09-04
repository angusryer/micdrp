/**
 * Turning a recording into pitch frames the way the engine does.
 *
 * The device runs the C++ detector; this runs the TypeScript one in
 * packages/logic, which is the same algorithm and is what the worklet
 * fallback uses on a device without the native module. Close enough to
 * ask "would this reading change if the pipeline changed", which is the
 * question the corpus exists to answer — and not close enough to settle
 * anything about the C++ detector itself, which has to be measured on a
 * device.
 */
import { logic, type PitchFrame } from './logic.ts';

/** The engine's shape of a frame: window, hop, and the bounds it honours. */
export interface FrameOptions {
  frameSize: number;
  hopSize: number;
  minFrequencyHz: number;
  maxFrequencyHz: number;
  clarityThreshold: number;
  /** Below this, a frame is called unvoiced however clear it looked. */
  voicedClarityMin: number;
}

/** Mirrors DEFAULT_ENGINE_CONFIG; the client owns the real one. */
export const DEFAULT_FRAMES: FrameOptions = {
  frameSize: 2048,
  hopSize: 512,
  minFrequencyHz: 70,
  maxFrequencyHz: 2500,
  clarityThreshold: 0.9,
  voicedClarityMin: 0.5
};

const midiOf = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

/** Run the detector across a recording, one window at a time. */
export function framesOf(
  samples: Float32Array,
  sampleRateHz: number,
  options: FrameOptions = DEFAULT_FRAMES
): PitchFrame[] {
  const { frameSize, hopSize } = options;
  const out: PitchFrame[] = [];
  for (let at = 0; at + frameSize <= samples.length; at += hopSize) {
    const window = samples.subarray(at, at + frameSize);
    const { frequency, clarity } = logic.detectPitch(window, sampleRateHz, {
      clarityThreshold: options.clarityThreshold,
      minFrequency: options.minFrequencyHz,
      maxFrequency: options.maxFrequencyHz
    });
    const voiced = frequency != null && clarity >= options.voicedClarityMin;
    const exact = voiced ? midiOf(frequency) : null;
    const midi = exact == null ? null : Math.round(exact);
    out.push({
      timestampMs: (at / sampleRateHz) * 1000,
      midi,
      cents: exact == null || midi == null ? null : Math.round((exact - midi) * 100),
      clarity,
      levelDb: 20 * Math.log10(rms(window) + 1e-12)
    });
  }
  return out;
}

function rms(window: Float32Array): number {
  let sum = 0;
  for (const s of window) {
    sum += s * s;
  }
  return Math.sqrt(sum / window.length);
}
