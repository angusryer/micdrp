/**
 * The statements kept with a note, cut into one slice per layer
 * (INV-NOTES-260).
 *
 * One flat document on the wire — the backend keeps what it is sent and
 * drops what it does not know, so nesting would lose every statement until
 * it caught up. Three slices in the model, because the boundary between
 * layers has to be a type the compiler enforces rather than a convention
 * that holds until the next field is added to the wrong function.
 *
 * Duck-typed to the wire document rather than importing it: this package
 * stands alone, and the document is assignable to `Statements` by shape.
 */
import type { ChordSlotEdit } from '../interpretation';
import type { NoteEdit } from '../noteEdits';
import type { Pickup } from '../pickup';
import type { TapPattern } from '../tapPattern';
import type { TappedBeat } from '../tappedBeats';
import type { WrittenNote } from '../writtenNotes';

/** Everything a person has said about a take, as it is stored. */
export interface Statements {
  notes?: readonly NoteEdit[];
  writtenNotes?: readonly WrittenNote[];
  deletedNotes?: readonly number[];
  beats?: readonly TappedBeat[];
  dismissedBeats?: readonly number[];
  barLines?: readonly number[];
  bpm?: number;
  tapPattern?: TapPattern;
  pickup?: Pickup | null;
  chords?: readonly ChordSlotEdit[];
  harmony?: { askedAtMs: number; analysisVersion: number } | null;
}

/** Corrections to what was sung, and nothing about when (INV-NOTES-257). */
export interface TranscriptionSlice {
  notes: readonly NoteEdit[];
  writtenNotes: readonly WrittenNote[];
  deletedNotes: readonly number[];
}

/** Corrections to the beat, the bars, the tempo and the count-in. */
export interface RhythmSlice {
  beats: readonly TappedBeat[];
  dismissedBeats: readonly number[];
  barLines: readonly number[] | undefined;
  bpm: number | undefined;
  tapPattern: TapPattern | undefined;
  pickup: Pickup | null;
}

/** Corrections to the chords, and whether anybody asked for them. */
export interface HarmonySlice {
  chords: readonly ChordSlotEdit[];
  isWanted: boolean;
}

const NONE: readonly never[] = [];

export function transcriptionSlice(s: Statements): TranscriptionSlice {
  return {
    notes: s.notes ?? NONE,
    writtenNotes: s.writtenNotes ?? NONE,
    deletedNotes: s.deletedNotes ?? NONE
  };
}

export function rhythmSlice(s: Statements): RhythmSlice {
  return {
    beats: s.beats ?? NONE,
    dismissedBeats: s.dismissedBeats ?? NONE,
    barLines: s.barLines,
    bpm: s.bpm,
    tapPattern: s.tapPattern,
    pickup: s.pickup ?? null
  };
}

export function harmonySlice(s: Statements): HarmonySlice {
  return { chords: s.chords ?? NONE, isWanted: s.harmony != null };
}
