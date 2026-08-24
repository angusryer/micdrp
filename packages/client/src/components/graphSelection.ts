/**
 * graphSelection — what a touch on the graph is pointing at.
 *
 * The graph is a small space carrying bar lines and chord notes, several of
 * which can sit at the same moment. Every overlay used to own its own
 * full-size gesture layer, so whichever was drawn last swallowed everything
 * underneath it. One place that hit-tests everything replaces that, and
 * choosing a thing before acting on it is what makes the verbs nameable
 * controls rather than remembered gestures (INT-NOTES-015).
 *
 * Smallest target first: a chord note is a few points tall and can only be
 * meant, a sung note is larger, and a bar line spans the whole height and is
 * easy to hit from anywhere. Asking in that order means a deliberate touch
 * always beats an incidental one.
 */
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';

/** A bar line as the surface needs it: an index and where it is drawn. */
export interface BarHandlePoint {
  lineIndex: number;
  x: number;
}

export type Selection =
  | { kind: 'barLine'; lineIndex: number }
  | { kind: 'chordTone'; slot: number; tone: number }
  | { kind: 'melodyNote'; index: number }
  /** A note from a second take sung against this one (INV-NOTES-118). */
  | { kind: 'layerNote'; index: number }
  /** A struck sound, in the rhythm band below the drawing (INV-NOTES-118). */
  | { kind: 'hit'; index: number };

/** How far from a bar line a touch still means that line. */
export const BAR_REACH = 22;

/** How far from a chord note's centre a touch still means that note. */
export const TONE_REACH = 22;

/** How far from a sung note a touch still means that note. */
export const NOTE_REACH = 20;

/** How far from a struck sound's mark a touch still means that sound. */
export const HIT_REACH = 16;

/**
 * Everything chosen at once, which is always of one kind (INV-NOTES-093).
 *
 * An array rather than a set: order is the order things were chosen, which is
 * the order the sheet lists them in, and a handful of objects is not worth a
 * hash.
 */
export type Chosen = readonly Selection[];

/** What kind of thing this is, for the rule that they must all match. */
export const kindOf = (selection: Selection): Selection['kind'] =>
  selection.kind;

/** Whether this exact thing is already chosen. */
export function isChosen(chosen: Chosen, selection: Selection): boolean {
  return chosen.some((one) => isSame(one, selection));
}

/**
 * Add a thing to what is chosen, or take it out if it was already there.
 *
 * Choosing something of a different kind replaces everything rather than
 * joining it: a downbeat and a sung note take different verbs, and a set
 * holding both could offer neither (INV-NOTES-093).
 */
export function toggleChosen(chosen: Chosen, selection: Selection): Chosen {
  if (isChosen(chosen, selection)) {
    return chosen.filter((one) => !isSame(one, selection));
  }
  const first = chosen[0];
  if (first && kindOf(first) !== kindOf(selection)) {
    return [selection];
  }
  return [...chosen, selection];
}

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
  if (a.kind === 'melodyNote' && b.kind === 'melodyNote') {
    return a.index === b.index;
  }
  if (a.kind === 'layerNote' && b.kind === 'layerNote') {
    return a.index === b.index;
  }
  if (a.kind === 'hit' && b.kind === 'hit') {
    return a.index === b.index;
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
/** A struck sound as the surface needs it: where its mark was drawn. */
export interface HitPoint {
  index: number;
  x: number;
  y: number;
}

export function selectionAt(
  x: number,
  y: number,
  tones: readonly ChordToneRect[],
  bars: readonly BarHandlePoint[],
  notes: readonly NoteRect[] = [],
  layerNotes: readonly NoteRect[] = [],
  hits: readonly HitPoint[] = []
): Selection | null {
  // The rhythm band first, and by distance in both directions. It sits below
  // the drawing in a region of its own, so a touch there is unambiguous —
  // nothing else is drawn in it (INV-NOTES-118).
  let bestHit = -1;
  let bestHitGap = HIT_REACH;
  for (const point of hits) {
    const gap = Math.hypot(x - point.x, y - point.y);
    if (gap <= bestHitGap) {
      bestHitGap = gap;
      bestHit = point.index;
    }
  }
  if (bestHit >= 0) {
    return { kind: 'hit', index: bestHit };
  }
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

  let bestNote = -1;
  let bestNoteGap = NOTE_REACH;
  notes.forEach((rect, index) => {
    if (x < rect.x || x > rect.x + rect.width) {
      return;
    }
    const gap = Math.abs(y - rect.cy);
    if (gap <= bestNoteGap) {
      bestNoteGap = gap;
      bestNote = index;
    }
  });
  if (bestNote >= 0) {
    return { kind: 'melodyNote', index: bestNote };
  }

  // The layer after the sung line: it is drawn behind, so a touch that could
  // mean either means the one in front (INV-NOTES-118).
  let bestLayer = -1;
  let bestLayerGap = NOTE_REACH;
  layerNotes.forEach((rect, index) => {
    if (x < rect.x || x > rect.x + rect.width) {
      return;
    }
    const gap = Math.abs(y - rect.cy);
    if (gap <= bestLayerGap) {
      bestLayerGap = gap;
      bestLayer = index;
    }
  });
  if (bestLayer >= 0) {
    return { kind: 'layerNote', index: bestLayer };
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
  bars: readonly BarHandlePoint[],
  notes: readonly NoteRect[] = [],
  layerNotes: readonly NoteRect[] = [],
  hits: readonly HitPoint[] = []
): boolean {
  if (!selection) {
    return false;
  }
  return isSame(
    selection,
    selectionAt(x, y, tones, bars, notes, layerNotes, hits)
  );
}
