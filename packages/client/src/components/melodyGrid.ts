/**
 * melodyGrid — the metrical frame drawn behind a melody: where the bar lines
 * and beats fall, in pixels.
 *
 * Split from melodyLayout so each file stays inside the size budget, and
 * because this is the only part that knows about tempo. It takes the finished
 * time-to-pixel mapping rather than deriving its own: a rule drawn with
 * slightly different arithmetic from the notes lands beside them rather than
 * under them (INV-NOTES-034).
 */

import { xForMs } from './melodyScale';

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

/**
 * Narrower than this and a beat rule is no longer a rule, it is texture.
 *
 * Thinning is decided by how wide a beat actually is rather than by how many
 * there are, so it behaves the same whether the take was squeezed to fit or
 * laid out at a fixed scale — and so zooming in brings the beats back at the
 * width where they start being readable. Bar lines are never thinned: they
 * are content, and dropping one would move the metre (INV-NOTES-033).
 */
export const MIN_LEGIBLE_BEAT_PX = 9;

/**
 * Vertical rules across the melody's time span.
 *
 * Lines outside the sung span are skipped: the view is scaled to the melody,
 * so a bar line before the first note or after the last has nothing to mark.
 */
export function layoutGridLines(
  grid: MelodyGrid,
  t0: number,
  span: number,
  pad: number,
  pxPerMs: number
): GridLine[] {
  const beatMs = 60000 / grid.bpm;
  // A zero bpm yields an infinite beat, which passes a bare `> 0` check and
  // then collapses the whole take onto a single rule at beat zero.
  if (!Number.isFinite(beatMs) || beatMs <= 0 || !(grid.beatsPerBar > 0)) {
    return [];
  }
  const t1 = t0 + span;
  const beatsAreLegible = beatMs * pxPerMs >= MIN_LEGIBLE_BEAT_PX;
  const xOf = (timeMs: number) =>
    xForMs({ t0, span, pad, innerW: 0, pxPerMs }, timeMs);

  // An arrangement someone has made replaces the even spacing entirely: its
  // bars differ from one another, which is the whole point of arranging them.
  if (grid.barSteps && grid.stepsPerBeat && grid.stepsPerBeat > 0) {
    const stepMs = beatMs / grid.stepsPerBeat;
    const lines: GridLine[] = [];
    let bar = 0;
    for (const step of grid.barSteps) {
      const timeMs = grid.offsetMs + step * stepMs;
      if (timeMs < t0 || timeMs > t1) {
        continue;
      }
      bar += 1;
      lines.push({ x: xOf(timeMs), isBar: true, bar, step });
    }
    return lines;
  }

  const lines: GridLine[] = [];
  const firstBeat = Math.ceil((t0 - grid.offsetMs) / beatMs);
  const lastBeat = Math.floor((t1 - grid.offsetMs) / beatMs);
  for (let beat = firstBeat; beat <= lastBeat; beat++) {
    let position = beat % grid.beatsPerBar;
    if (position < 0) {
      position += grid.beatsPerBar;
    }
    const isBar = position === 0;
    if (!isBar && !beatsAreLegible) {
      continue;
    }
    lines.push({
      x: xOf(grid.offsetMs + beat * beatMs),
      isBar,
      bar: isBar ? Math.floor(beat / grid.beatsPerBar) + 1 : null
    });
  }
  return lines;
}
