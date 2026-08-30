/**
 * What a touch on the graph is pointing at.
 *
 * The graph is a small space carrying bar lines, tapped beats, chord notes and
 * two sung lines, several of which can sit at the same moment. Every overlay
 * used to own its own full-size gesture layer, so whichever was drawn last
 * swallowed everything underneath it. One place that hit-tests everything
 * replaces that (INT-NOTES-015).
 *
 * Two rules decide ties. Smallest target first: a chord note is a few points
 * tall and can only be meant, while a line spans the whole height and is easy
 * to hit from anywhere. And inside beats near: a touch within a thing means
 * that thing, and only where it is inside nothing does distance decide
 * (INV-NOTES-173).
 */
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import {
  BAR_REACH,
  BEAT_REACH,
  HIT_REACH,
  NOTE_REACH,
  NOTE_X_REACH,
  TONE_REACH,
  isSame,
  type BarHandlePoint,
  type BeatLine,
  type HitPoint,
  type Selection
} from './graphSelection';

/** A candidate, how far the touch is from it, and whether it is within it. */
interface Near {
  selection: Selection;
  gap: number;
  isInside: boolean;
}

/** How far outside a span a position sits, or zero when it is within it. */
function outside(v: number, from: number, to: number): number {
  return Math.max(from - v, v - to, 0);
}

/** The struck sound nearest a touch, by distance in both directions. */
function nearestHit(hits: readonly HitPoint[], x: number, y: number): Near | null {
  let found: Near | null = null;
  for (const point of hits) {
    const gap = Math.hypot(x - point.x, y - point.y);
    if (gap <= HIT_REACH && (!found || gap <= found.gap)) {
      found = { selection: { kind: 'hit', index: point.index }, gap, isInside: true };
    }
  }
  return found;
}

/** The chord note nearest a touch, within the slot the touch falls in. */
function nearestTone(
  tones: readonly ChordToneRect[],
  x: number,
  y: number
): Near | null {
  let found: Near | null = null;
  for (const rect of tones) {
    if (x < rect.x || x > rect.x + rect.width) {
      continue;
    }
    const gap = Math.abs(y - (rect.y + rect.height / 2));
    if (gap <= TONE_REACH && (!found || gap <= found.gap)) {
      found = {
        selection: { kind: 'chordTone', slot: rect.slot, tone: rect.tone },
        gap,
        isInside: true
      };
    }
  }
  return found;
}

/**
 * The sung note nearest a touch.
 *
 * Reach in both directions, because a whistled note can be a handful of pixels
 * wide and a hairline is not a target (INV-NOTES-173). Ranked by the straight
 * distance to the note's own body, so one under the finger beats one beside
 * it.
 */
function nearestNote(
  notes: readonly NoteRect[],
  x: number,
  y: number,
  kind: 'melodyNote' | 'layerNote'
): Near | null {
  let found: Near | null = null;
  notes.forEach((rect, index) => {
    const dx = outside(x, rect.x, rect.x + rect.width);
    const dy = Math.abs(y - rect.cy);
    if (dx > NOTE_X_REACH || dy > NOTE_REACH) {
      return;
    }
    const gap = Math.hypot(dx, dy);
    if (!found || gap <= found.gap) {
      found = { selection: { kind, index }, gap, isInside: dx === 0 };
    }
  });
  return found;
}

/** The vertical line nearest a touch: a tapped beat first, then a bar line. */
function nearestLine(
  beats: readonly BeatLine[],
  bars: readonly BarHandlePoint[],
  x: number
): Near | null {
  // A tapped beat before a bar line: it is the narrower claim of the two —
  // somebody put it exactly there — and a bar line is derived (INV-NOTES-130).
  let found: Near | null = null;
  for (const beat of beats) {
    const gap = Math.abs(x - beat.x);
    if (gap <= BEAT_REACH && (!found || gap <= found.gap)) {
      found = { selection: { kind: 'beat', index: beat.index }, gap, isInside: true };
    }
  }
  if (found) {
    return found;
  }
  for (const bar of bars) {
    const gap = Math.abs(x - bar.x);
    if (gap <= BAR_REACH && (!found || gap <= found.gap)) {
      found = {
        selection: { kind: 'barLine', lineIndex: bar.lineIndex },
        gap,
        isInside: true
      };
    }
  }
  return found;
}

export function selectionAt(
  x: number,
  y: number,
  tones: readonly ChordToneRect[],
  bars: readonly BarHandlePoint[],
  notes: readonly NoteRect[] = [],
  layerNotes: readonly NoteRect[] = [],
  hits: readonly HitPoint[] = [],
  beats: readonly BeatLine[] = []
): Selection | null {
  // The rhythm band first. It sits in a region of its own inside the drawing,
  // so a touch there is unambiguous — nothing else is drawn in it
  // (INV-NOTES-118).
  const hit = nearestHit(hits, x, y);
  if (hit) {
    return hit.selection;
  }
  const tone = nearestTone(tones, x, y);
  if (tone) {
    return tone.selection;
  }
  // The layer only where the sung line has nothing: it is drawn behind, so a
  // touch that could mean either means the one in front (INV-NOTES-118).
  const note =
    nearestNote(notes, x, y, 'melodyNote') ??
    nearestNote(layerNotes, x, y, 'layerNote');
  const line = nearestLine(beats, bars, x);
  if (note && (note.isInside || !line || note.gap <= line.gap)) {
    return note.selection;
  }
  return line?.selection ?? null;
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
  hits: readonly HitPoint[] = [],
  beats: readonly BeatLine[] = []
): boolean {
  if (!selection) {
    return false;
  }
  return isSame(
    selection,
    selectionAt(x, y, tones, bars, notes, layerNotes, hits, beats)
  );
}
