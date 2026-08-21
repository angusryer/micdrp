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

/**
 * The metrical frame to draw behind the notes, from `logic`'s `fitGrid`.
 *
 * Only the fields the drawing needs, so the layout math stays independent of
 * the full `MusicalGrid` shape.
 */
export interface MelodyGrid {
  bpm: number;
  /** Time of the first bar line, in ms. */
  offsetMs: number;
  beatsPerBar: number;
  /**
   * Grid steps to a beat. Needed only when `barSteps` is given, since a bar
   * line sits on a step rather than on a beat.
   */
  stepsPerBeat?: number;
  /**
   * Where the bars actually begin, as grid step indices.
   *
   * Supplied once a person has arranged them. Without it the bars are evenly
   * spaced by `beatsPerBar`, which is what detection proposes — and which
   * cannot express a take whose bars differ from one another.
   */
  barSteps?: readonly number[];
}

/** A vertical rule behind the melody: a bar line or a plain beat. */
export interface GridLine {
  x: number;
  /** True for a bar line, false for an ordinary beat within the bar. */
  isBar: boolean;
  /** 1-based bar number, set only on bar lines. */
  bar: number | null;
  /**
   * Grid step this line sits on, set only on bar lines from an arrangement.
   * A drag needs it to say which line it is moving.
   */
  step?: number;
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
  /** When given, bar and beat rules are positioned across the same time span. */
  grid?: MelodyGrid;
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
  /**
   * How time maps onto the x axis, so a caller can turn a touch back into a
   * moment. Exposed rather than recomputed: a drag that used a slightly
   * different mapping from the one that drew the lines would land beside them
   * rather than on them.
   */
  timeAxis: { t0: number; span: number; pad: number; innerW: number };
}

/**
 * Cap on the rules drawn across one view.
 *
 * A long take at a fast tempo can imply hundreds of beats, which at this
 * width would be a grey wash rather than a readable grid. Past the cap the
 * beats are dropped and only bar lines are kept, which is the information that
 * actually helps at that zoom.
 */
const MAX_GRID_LINES = 96;

/**
 * Vertical rules for the grid across the melody's visible time span.
 *
 * Lines outside the sung span are skipped: the view is scaled to the melody,
 * not to the grid, so a bar line before the first note or after the last has
 * nothing to mark.
 */
function layoutGridLines(
  grid: MelodyGrid,
  t0: number,
  span: number,
  pad: number,
  innerW: number
): GridLine[] {
  const beatMs = 60000 / grid.bpm;
  // A zero bpm yields an infinite beat, which passes a bare `> 0` check and
  // then collapses the whole take onto a single rule at beat zero.
  if (!Number.isFinite(beatMs) || beatMs <= 0 || !(grid.beatsPerBar > 0)) {
    return [];
  }
  const t1 = t0 + span;
  const totalBeats = span / beatMs;
  // Beats become noise long before bars do, so thin them out first.
  const beatsFit = totalBeats <= MAX_GRID_LINES;

  const lines: GridLine[] = [];

  // An arrangement someone has made replaces the even spacing entirely: its
  // bars differ from one another, which is the whole point of arranging them.
  if (grid.barSteps && grid.stepsPerBeat && grid.stepsPerBeat > 0) {
    const stepMs = beatMs / grid.stepsPerBeat;
    let bar = 0;
    for (const step of grid.barSteps) {
      const timeMs = grid.offsetMs + step * stepMs;
      if (timeMs < t0 || timeMs > t1) {
        continue;
      }
      bar += 1;
      lines.push({
        x: pad + ((timeMs - t0) / span) * innerW,
        isBar: true,
        bar,
        step
      });
    }
    return lines;
  }

  const firstBeat = Math.ceil((t0 - grid.offsetMs) / beatMs);
  const lastBeat = Math.floor((t1 - grid.offsetMs) / beatMs);
  for (let beat = firstBeat; beat <= lastBeat; beat++) {
    let position = beat % grid.beatsPerBar;
    if (position < 0) {
      position += grid.beatsPerBar;
    }
    const isBar = position === 0;
    if (!isBar && !beatsFit) {
      continue;
    }
    const timeMs = grid.offsetMs + beat * beatMs;
    lines.push({
      x: pad + ((timeMs - t0) / span) * innerW,
      isBar,
      bar: isBar ? Math.floor(beat / grid.beatsPerBar) + 1 : null
    });
  }
  return lines;
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

  const gridLines =
    options.grid && notes.length > 0
      ? layoutGridLines(options.grid, t0, span, pad, innerW)
      : [];

  return { rects, midiLow, midiHigh, gridLines, timeAxis: { t0, span, pad, innerW } };
}
