/**
 * practiceLayout — pure positioning math for the practice target+live overlay.
 *
 * Both layers share one time axis: a "now" marker sits at `nowFraction` of the
 * width; the visible window spans `windowMs`, so px-per-ms is constant and any
 * timestamp maps to an x. The Skia worklets in PracticePitchView inline these
 * exact formulas (Reanimated worklets can't call across modules), so this module
 * exists to unit-test the math the worklets mirror. Keep them in lock-step.
 */
import type { TargetNote } from 'logic';

export interface LayoutConfig {
  /** Canvas width in px. */
  width: number;
  /** Canvas height in px. */
  height: number;
  /** Horizontal position of "now", 0..1 (e.g. 0.6 → past left, future right). */
  nowFraction: number;
  /** Total time span visible across the width, in ms. */
  windowMs: number;
  /** Lowest MIDI note mapped to the bottom edge. */
  minMidi: number;
  /** Highest MIDI note mapped to the top edge. */
  maxMidi: number;
}

/** Pixels per millisecond across the window. */
export function pxPerMs(cfg: LayoutConfig): number {
  return cfg.width / cfg.windowMs;
}

/** The x of the "now" marker. */
export function nowX(cfg: LayoutConfig): number {
  return cfg.width * cfg.nowFraction;
}

/** Map an absolute time (ms) to an x, given the current transport time. */
export function timeToX(timeMs: number, currentMs: number, cfg: LayoutConfig): number {
  return nowX(cfg) + (timeMs - currentMs) * pxPerMs(cfg);
}

/** Map a MIDI note to a y (clamped to the canvas; higher note → higher up). */
export function midiToY(midi: number, cfg: LayoutConfig): number {
  const span = Math.max(1, cfg.maxMidi - cfg.minMidi);
  const norm = (midi - cfg.minMidi) / span;
  const clamped = norm < 0 ? 0 : norm > 1 ? 1 : norm;
  return cfg.height - clamped * cfg.height;
}

export interface TargetSegment {
  x1: number;
  x2: number;
  y: number;
}

/**
 * The on-canvas segments for the target notes currently in view, given the
 * transport time. Off-screen notes (entirely left or right of the canvas) are
 * culled.
 */
export function visibleTargetSegments(
  targets: readonly TargetNote[],
  currentMs: number,
  cfg: LayoutConfig
): TargetSegment[] {
  const out: TargetSegment[] = [];
  for (const t of targets) {
    const x1 = timeToX(t.startMs, currentMs, cfg);
    const x2 = timeToX(t.endMs, currentMs, cfg);
    if (x2 < 0 || x1 > cfg.width) {
      continue;
    }
    out.push({ x1, x2, y: midiToY(t.midi, cfg) });
  }
  return out;
}
