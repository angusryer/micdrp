/**
 * graphSelection — what can be chosen on the graph, and how far it reaches.
 *
 * The vocabulary only: what a selection is, whether two name the same thing,
 * and how close a touch must be to mean each kind. Reading an actual touch
 * against a drawn graph is graphHitTest, split out to hold the file budget.
 *
 * Choosing a thing before acting on it is what makes the verbs nameable
 * controls rather than remembered gestures (INT-NOTES-015).
 */
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
  | { kind: 'hit'; index: number }
  /** A beat somebody tapped along with the take (INV-NOTES-130). */
  | { kind: 'beat'; index: number };

/** How far from a bar line a touch still means that line. */
export const BAR_REACH = 22;

/** How far from a chord note's centre a touch still means that note. */
export const TONE_REACH = 22;

/** How far above or below a sung note a touch still means that note. */
export const NOTE_REACH = 20;

/**
 * How far to either side of a sung note a touch still means that note.
 *
 * Shorter than the vertical reach, because time is the axis notes are packed
 * along: a generous one here would have a note swallow its neighbour. Without
 * any, a whistled note a few pixels wide was a hairline and the beat beside it
 * took every touch (INV-NOTES-173).
 */
export const NOTE_X_REACH = 12;

/** How far from a struck sound's mark a touch still means that sound. */
export const HIT_REACH = 16;

/** How far from a tapped beat a touch still means that beat. */
export const BEAT_REACH = 14;

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
  if (a.kind === 'beat' && b.kind === 'beat') {
    return a.index === b.index;
  }
  return false;
}

/** A struck sound as the surface needs it: where its mark was drawn. */
export interface HitPoint {
  index: number;
  x: number;
  y: number;
}

/** A tapped beat as the surface needs it: an index and where it is drawn. */
export interface BeatLine {
  index: number;
  x: number;
}
