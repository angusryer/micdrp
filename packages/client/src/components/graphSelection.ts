/**
 * graphSelection — what a touch on the graph is pointing at.
 *
 * The graph is a small space carrying bar lines and chord notes, several of
 * which can sit at the same moment. Every overlay used to own its own
 * full-size gesture layer, so whichever was drawn last swallowed everything
 * underneath it. One place that hit-tests everything replaces that, and
 * choosing a thing before acting on it is what makes the verbs nameable
 * controls rather than remembered gestures (INT-NOTES-015).
 */
import type { ChordToneRect } from './chordLayout';

/** A bar line as the surface needs it: an index and where it is drawn. */
export interface BarHandlePoint {
  lineIndex: number;
  x: number;
}

export type Selection =
  | { kind: 'barLine'; lineIndex: number }
  | { kind: 'chordTone'; slot: number; tone: number };

/** How far from a bar line a touch still means that line. */
export const BAR_REACH = 22;

/** How far from a chord note's centre a touch still means that note. */
export const TONE_REACH = 22;

/** Whether two selections point at the same thing. */
export function isSame(a: Selection | null, b: Selection | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  if (a.kind === 'barLine' && b.kind === 'barLine') {
    return a.lineIndex === b.lineIndex;
  }
  if (a.kind === 'chordTone' && b.kind === 'chordTone') {
    return a.slot === b.slot && a.tone === b.tone;
  }
  return false;
}

/**
 * What a touch is pointing at, or null for empty space.
 *
 * A chord note wins a tie against a bar line, being the smaller target: a bar
 * line spans the whole height and is easy to hit from anywhere, while a note
 * is a few points tall and can only be meant deliberately.
 */
export function selectionAt(
  x: number,
  y: number,
  tones: readonly ChordToneRect[],
  bars: readonly BarHandlePoint[]
): Selection | null {
  let bestTone: ChordToneRect | null = null;
  let bestToneGap = TONE_REACH;
  for (const rect of tones) {
    if (x < rect.x || x > rect.x + rect.width) {
      continue;
    }
    const gap = Math.abs(y - (rect.y + rect.height / 2));
    if (gap <= bestToneGap) {
      bestToneGap = gap;
      bestTone = rect;
    }
  }
  if (bestTone) {
    return { kind: 'chordTone', slot: bestTone.slot, tone: bestTone.tone };
  }

  let bestBar: BarHandlePoint | null = null;
  let bestBarGap = BAR_REACH;
  for (const bar of bars) {
    const gap = Math.abs(x - bar.x);
    if (gap <= bestBarGap) {
      bestBarGap = gap;
      bestBar = bar;
    }
  }
  return bestBar ? { kind: 'barLine', lineIndex: bestBar.lineIndex } : null;
}

/** Whether a touch lands on the thing already chosen, which is what may be dragged. */
export function touchesSelection(
  selection: Selection | null,
  x: number,
  y: number,
  tones: readonly ChordToneRect[],
  bars: readonly BarHandlePoint[]
): boolean {
  if (!selection) {
    return false;
  }
  return isSame(selection, selectionAt(x, y, tones, bars));
}
