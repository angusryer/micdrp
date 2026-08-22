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
  pitchBounds,
  yForMidi,
  type PitchAxis
} from './melodyPitch';
import {
  resolveScale,
  timeBounds,
  type ScaleRequest,
  type TimeAxis
} from './melodyScale';

export type { GridLine, MelodyGrid };
export { pitchBounds, yForMidi, midiForY, type PitchAxis } from './melodyPitch';
export {
  anchorZoom,
  beatWidthShowingAll,
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
  /**
   * Other pitches drawn on this axis — the chord tones under the line — so
   * the vertical window takes them in rather than letting them fall off it.
   */
  alsoShow?: readonly number[];
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
  pitchAxis: PitchAxis;
  /**
   * How wide the drawing is, padding included. Equals `width` when fitted;
   * larger than it when the take runs past the viewport and must scroll.
   */
  contentWidth: number;
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

  const { low: midiLow, high: midiHigh } = pitchBounds(notes, options.alsoShow);
  const range = Math.max(1, midiHigh - midiLow);

  // One lane per semitone; bars fill a fraction of a lane.
  const lane = innerH / (range + 1);
  const barH = Math.max(minBarH, lane * laneFill);

  const { t0, span } = timeBounds(notes);
  const { pxPerMs, contentWidth } = resolveScale(options, span, innerW, pad);

  const pitchAxis: PitchAxis = { midiLow, midiHigh, pad, innerH, lane };

  const rects: NoteRect[] = notes.map((n) => {
    const x = pad + (n.startMs - t0) * pxPerMs;
    const width = Math.max(2, (n.endMs - n.startMs) * pxPerMs - 1);
    const cy = yForMidi(pitchAxis, n.midi);
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
    pitchAxis,
    contentWidth
  };
}
