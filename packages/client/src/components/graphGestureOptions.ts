/**
 * What a touch on the graph is allowed to do, and what it is read against.
 *
 * Held apart from the gestures themselves so that the three files reading a
 * touch — choose, drag, hold — agree on one description of the graph rather
 * than each carrying its own parameter list.
 */
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import { selectionAt } from './graphHitTest';
import {
  type BarHandlePoint,
  type BeatLine,
  type Chosen,
  type HitPoint,
  type Selection
} from './graphSelection';

/** Pixels of drag that mean one semitone, when a lane is too small to use. */
export const MIN_SEMITONE_PX = 12;

export interface GraphGestureOptions {
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  notes: readonly NoteRect[];
  /** The layer's notes (INV-NOTES-118). */
  layerNotes?: readonly NoteRect[];
  /** Where each struck sound's mark sits (INV-NOTES-118). */
  hits?: readonly HitPoint[];
  /** Where each tapped beat is drawn (INV-NOTES-130). */
  beats?: readonly BeatLine[];
  laneHeight: number;
  originX: number;
  stepWidth: number;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  onMoveBar: (lineIndex: number, step: number) => void;
  /**
   * Move a tapped beat to a pixel position (INV-NOTES-130).
   *
   * In pixels rather than steps: a tapped beat is not on the grid — it is
   * what the grid is derived from — so snapping it to one would be the
   * reading correcting the statement it came from.
   */
  onMoveBeat?: (index: number, x: number) => void;
  /**
   * Throw a vertical line away — flicked across rather than along
   * (INV-NOTES-132). One call per line, so a set flicked together all goes.
   */
  onRemoveBar?: (lineIndex: number) => void;
  onRemoveBeat?: (index: number) => void;
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  onMoveNote: (index: number, semitones: number) => void;
  onAddBar: (step: number) => void;
  /**
   * Whether a dragged line lands on the grid (INV-NOTES-143).
   *
   * Bars always snapped and notes never did, which was never a decision. One
   * control now says which behaviour is wanted, for both.
   */
  snapToGrid?: boolean;
  /**
   * The pitch the finger has just reached, once per semitone crossed. What
   * makes a drag its own audition (INV-NOTES-070).
   */
  onHear?: (midi: number) => void;
  /**
   * What is under the thumb while one thing is being dragged, or null when
   * nothing is. A person cannot judge a placement they are covering with
   * their own hand (INV-NOTES-025).
   */
  onPreview?: (preview: DragPreview | null) => void;
}

/**
 * The same, with every default already applied.
 *
 * Applied once where the options arrive rather than in each gesture: three
 * files each defaulting `beats` to `[]` is three places for them to disagree
 * about what an absent graph looks like (Axiom 2).
 */
export type SettledOptions = GraphGestureOptions &
  Required<
    Pick<GraphGestureOptions, 'layerNotes' | 'hits' | 'beats' | 'snapToGrid'>
  >;

/** The readout that follows a drag: where the finger is, and what it means. */
export interface DragPreview {
  x: number;
  y: number;
  /** The pitch it would become, named. */
  value: string;
  /** And as a number, so the loupe can draw it in its lane (INV-NOTES-110). */
  midi: number;
  /** How far it has come, so a small move is legible as a small move. */
  caption: string;
}

/** What the chosen thing sounds at, or null for something with no pitch. */
export function pitchOf(
  selection: Selection | null,
  tones: readonly ChordToneRect[],
  notes: readonly NoteRect[]
): number | null {
  if (selection?.kind === 'chordTone') {
    return (
      tones.find(
        (t) => t.slot === selection.slot && t.tone === selection.tone
      )?.midi ?? null
    );
  }
  if (selection?.kind === 'melodyNote') {
    return notes[selection.index]?.midi ?? null;
  }
  return null;
}

/** Which grid step a pixel position falls on. */
export function stepAtX(x: number, originX: number, stepWidth: number): number {
  return stepWidth > 0 ? Math.round((x - originX) / stepWidth) : 0;
}

/** Whatever is under a point on the graph, read against every layer of it. */
export function foundAt(
  o: SettledOptions,
  x: number,
  y: number
): Selection | null {
  return selectionAt(
    x,
    y,
    o.tones,
    o.bars,
    o.notes,
    o.layerNotes,
    o.hits,
    o.beats
  );
}
