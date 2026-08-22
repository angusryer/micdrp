/**
 * melodyLayout — pure positioning math for a "piano-roll" view of a melody
 * (x = time, y = pitch). Pure and dependency-free so the math is unit-tested
 * independently of the Skia view that draws it.
 *
 * Time is placed at a fixed beat width and scrolls, or fitted to the width
 * when no `beatWidth` is given — see melodyScale for which and why. Either
 * way the mapping ends up in `timeAxis.pxPerMs`, and everything (notes,
 * rules, gestures) goes through that one number.
 */
import {
  layoutGridLines,
  type GridLine,
  type MelodyGrid
} from './melodyGrid';
import {
  resolveScale,
  timeBounds,
  type ScaleRequest,
  type TimeAxis
} from './melodyScale';

export type { GridLine, MelodyGrid };
export {
  clampBeatWidth,
  DEFAULT_BEAT_WIDTH,
  MIN_BEAT_WIDTH,
  type TimeAxis
} from './melodyScale';

/** The minimal note shape this layout needs (a `NoteEvent`/`NoteEventDto` subset). */
export interface MelodyNote {
  midi: number;
  startMs: number;
  endMs: number;
}

export interface MelodyLayoutOptions extends ScaleRequest {
  height: number;
  /** Inset from every edge, in px (default 6). */
  padding?: number;
  /** Fraction of a pitch lane each note bar fills, 0..1 (default 0.7). */
  laneFill?: number;
  /** Minimum bar thickness in px (default 3). */
  minBarHeight?: number;
}

/** One positioned note bar plus the centre point used for the contour line. */
export interface NoteRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Vertical centre of the bar (for the connecting contour). */
  cy: number;
  midi: number;
}

export interface MelodyLayout {
  rects: NoteRect[];
  /** Lowest pitch lane shown (one semitone below the lowest sung note). */
  midiLow: number;
  /** Highest pitch lane shown (one semitone above the highest sung note). */
  midiHigh: number;
  /** Bar and beat rules, empty unless a grid was supplied. */
  gridLines: GridLine[];
  timeAxis: TimeAxis;
  /**
   * How wide the drawing is, padding included. Equals `width` when fitted;
   * larger than it when the take runs past the viewport and must scroll.
   */
  contentWidth: number;
}

/**
 * Pitch bounds for a melody, padded by a semitone on each side so notes never
 * sit flush against the top/bottom edge. A single-pitch (or empty) melody gets a
 * symmetric ±2-semitone window so it still renders as a centred bar.
 */
export function pitchBounds(notes: readonly MelodyNote[]): {
  low: number;
  high: number;
} {
  if (notes.length === 0) {
    return { low: -2, high: 2 };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  if (hi - lo < 2) {
    // Near-monotone: widen so the contour has vertical room.
    const mid = (hi + lo) / 2;
    return { low: Math.floor(mid - 2), high: Math.ceil(mid + 2) };
  }
  return { low: lo - 1, high: hi + 1 };
}

/**
 * Lay a melody out as note bars. Time runs left→right from the first note's
 * start; pitch runs bottom→top over the padded sung range.
 */
export function layoutMelody(
  notes: readonly MelodyNote[],
  options: MelodyLayoutOptions
): MelodyLayout {
  const pad = options.padding ?? 6;
  const laneFill = options.laneFill ?? 0.7;
  const minBarH = options.minBarHeight ?? 3;

  const innerW = Math.max(1, options.width - 2 * pad);
  const innerH = Math.max(1, options.height - 2 * pad);

  const { low: midiLow, high: midiHigh } = pitchBounds(notes);
  const range = Math.max(1, midiHigh - midiLow);

  // One lane per semitone; bars fill a fraction of a lane.
  const lane = innerH / (range + 1);
  const barH = Math.max(minBarH, lane * laneFill);

  const { t0, span } = timeBounds(notes);
  const { pxPerMs, contentWidth } = resolveScale(options, span, innerW, pad);

  const rects: NoteRect[] = notes.map((n) => {
    const x = pad + (n.startMs - t0) * pxPerMs;
    const width = Math.max(2, (n.endMs - n.startMs) * pxPerMs - 1);
    // Centre each lane vertically; higher MIDI → smaller y (towards the top).
    const norm = (n.midi - midiLow) / range; // 0..1
    const cy = pad + (1 - norm) * innerH;
    return { x, y: cy - barH / 2, width, height: barH, cy, midi: n.midi };
  });

  const gridLines =
    options.grid && notes.length > 0
      ? layoutGridLines(options.grid, t0, span, pad, pxPerMs)
      : [];

  return {
    rects,
    midiLow,
    midiHigh,
    gridLines,
    timeAxis: { t0, span, pad, innerW, pxPerMs },
    contentWidth
  };
}
