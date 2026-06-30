/**
 * melodyLayout — pure positioning math for a static "piano-roll" view of a whole
 * melody (x = time, y = pitch). Unlike `practiceLayout` (a scrolling window with
 * a moving "now"), this fits an entire {@link NoteEvent}-like sequence to a fixed
 * canvas: the full time span maps across the width, the sung pitch range maps up
 * the height. Pure and dependency-free so the math is unit-tested independently
 * of the Skia view that draws it.
 */

/** The minimal note shape this layout needs (a `NoteEvent`/`NoteEventDto` subset). */
export interface MelodyNote {
  midi: number;
  startMs: number;
  endMs: number;
}

export interface MelodyLayoutOptions {
  width: number;
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
 * Lay a melody out as note bars across a fixed canvas. Time runs left→right over
 * the full span (first note's start to last note's end); pitch runs bottom→top
 * over the padded sung range. Returns the bars plus the pitch window used.
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

  let t0 = Infinity;
  let t1 = -Infinity;
  for (const n of notes) {
    if (n.startMs < t0) t0 = n.startMs;
    if (n.endMs > t1) t1 = n.endMs;
  }
  const span = notes.length > 0 ? Math.max(1, t1 - t0) : 1;

  const rects: NoteRect[] = notes.map((n) => {
    const x = pad + ((n.startMs - t0) / span) * innerW;
    const width = Math.max(2, ((n.endMs - n.startMs) / span) * innerW - 1);
    // Centre each lane vertically; higher MIDI → smaller y (towards the top).
    const norm = (n.midi - midiLow) / range; // 0..1
    const cy = pad + (1 - norm) * innerH;
    return {
      x,
      y: cy - barH / 2,
      width,
      height: barH,
      cy,
      midi: n.midi
    };
  });

  return { rects, midiLow, midiHigh };
}
