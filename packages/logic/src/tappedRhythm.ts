/**
 * A rhythm tapped in with a finger, rather than sung.
 *
 * Mouth drums have to be heard through a microphone and told apart from
 * singing, which is a reading and can be wrong (INV-PITCH-025). A tap is not a
 * reading at all: the moment is the moment the finger landed, and there is
 * nothing to detect and nothing to mistake it for. It is the most certain
 * input the app has (INV-NOTES-129).
 *
 * So this exists beside the detector rather than instead of it. Singing a
 * rhythm is faster and keeps your hands free; tapping one is exact, works in a
 * noisy room, and works when what you want is a part you cannot sing.
 */
import type { Hit, HitKind } from './percussion';
import type { MusicalGrid } from './quantize';

/** One press: when it landed, and what it was meant to be. */
export interface Tap {
  atMs: number;
  kind: HitKind;
}

export interface TapOptions {
  /**
   * Snap each tap to the nearest grid step. Off by default: a tap is already
   * exact, and rounding it is a claim about intent rather than about timing.
   */
  snapToGrid?: boolean;
  /** How long a tapped hit is taken to sound (default 40ms). */
  durationMs?: number;
  /** How loud a tapped hit is taken to be, in dBFS (default -12). */
  loudnessDb?: number;
}

/** Taps closer together than this are one press bouncing, not two. */
const DEBOUNCE_MS = 45;

/**
 * Taps to hits.
 *
 * Confident by construction: a tap was made on purpose, so the confidence is
 * not a guess about whether it happened. Its brightness is unknown, because
 * nothing about a finger says what the sound should be — the kind is what was
 * chosen, and the timbre is the player's to decide (INV-NOTES-129).
 */
export function hitsFromTaps(
  taps: readonly Tap[],
  grid: MusicalGrid | null = null,
  options: TapOptions = {}
): Hit[] {
  const durationMs = options.durationMs ?? 40;
  const loudnessDb = options.loudnessDb ?? -12;
  const ordered = [...taps].sort((a, b) => a.atMs - b.atMs);

  const hits: Hit[] = [];
  for (const tap of ordered) {
    const atMs = options.snapToGrid && grid ? snap(tap.atMs, grid) : tap.atMs;
    const last = hits[hits.length - 1];
    // A finger bouncing is one press. Snapping can also land two taps on one
    // step, which is the same thing said a different way.
    if (last != null && atMs - last.atMs < DEBOUNCE_MS) {
      continue;
    }
    hits.push({
      atMs: Math.max(0, atMs),
      durationMs,
      loudnessDb,
      // Nothing about a finger says where the energy sat. Null rather than a
      // number, because unknown and measured are different claims
      // (INV-PITCH-020).
      centroidHz: null,
      flatness: null,
      kind: tap.kind,
      // It was made on purpose. There is nothing to be unsure about.
      confidence: 1
    });
  }
  return hits;
}

/** The nearest grid step to a moment, in ms. */
function snap(atMs: number, grid: MusicalGrid): number {
  const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
  const perBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
  const stepMs = beatMs / perBeat;
  if (!(stepMs > 0)) {
    return atMs;
  }
  const steps = Math.round((atMs - grid.offsetMs) / stepMs);
  return grid.offsetMs + steps * stepMs;
}

/**
 * Everything struck in a take: what was sung, and what was tapped.
 *
 * Tapped hits win where they collide. A tap is a statement and a detected hit
 * is a reading, and where the two disagree about one moment the statement is
 * the one to keep (INV-NOTES-129).
 */
export function mergeHits(
  detected: readonly Hit[],
  tapped: readonly Hit[]
): Hit[] {
  const all = [...tapped];
  for (const hit of detected) {
    const clashes = tapped.some(
      (tap) => Math.abs(tap.atMs - hit.atMs) < DEBOUNCE_MS
    );
    if (!clashes) {
      all.push(hit);
    }
  }
  return all.sort((a, b) => a.atMs - b.atMs);
}
