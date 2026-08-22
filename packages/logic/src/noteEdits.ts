/**
 * noteEdits — corrections to what the detector heard.
 *
 * Kept as differences anchored to a moment, never as a replacement melody
 * (INV-NOTES-054). The melody as sung is the one thing that never changes:
 * overwrite it and the record of what was actually heard is gone, after which
 * no later improvement in detection can be applied, because there is nothing
 * left to re-read.
 *
 * Two functions, and they are inverses, in the same shape as the chord edits
 * beside them.
 */
import type { NoteEvent } from './segmentation';

/** A pitch someone corrected, anchored to a moment rather than an index. */
export interface NoteEdit {
  /** A time inside the note this applies to. */
  atMs: number;
  /** The pitch it should have been. */
  midi: number;
}

/** Whether a moment falls inside a note. End-exclusive, so notes cannot overlap. */
function covers(note: NoteEvent, atMs: number): boolean {
  return atMs >= note.startMs && atMs < note.endMs;
}

/**
 * Reduce a corrected melody to just the corrections.
 *
 * Anchored to each note's own start. Any moment inside would do, but the
 * start is the one that stays meaningful if the note is later shortened.
 */
export function collectNoteEdits(
  heard: readonly NoteEvent[],
  corrected: readonly NoteEvent[]
): NoteEdit[] {
  const edits: NoteEdit[] = [];
  for (let i = 0; i < corrected.length && i < heard.length; i++) {
    if (corrected[i].midi !== heard[i].midi) {
      edits.push({ atMs: heard[i].startMs, midi: corrected[i].midi });
    }
  }
  return edits;
}

/**
 * Put corrections back on top of freshly detected notes.
 *
 * A correction whose moment lands in no note is dropped rather than guessed
 * at. That happens when detection now hears the take differently, and moving
 * someone's correction onto whatever has since arrived there would put a
 * pitch they never chose into a note they never touched.
 *
 * Cents are cleared on a corrected note: the deviation described where the
 * voice sat against a pitch nobody is claiming any more.
 */
export function replayNoteEdits(
  heard: readonly NoteEvent[],
  edits: readonly NoteEdit[]
): NoteEvent[] {
  if (edits.length === 0) {
    return [...heard];
  }
  const notes = heard.map((n) => ({ ...n }));
  for (const edit of edits) {
    const index = notes.findIndex((n) => covers(n, edit.atMs));
    if (index === -1) {
      continue;
    }
    notes[index] = { ...notes[index], midi: Math.round(edit.midi), cents: 0 };
  }
  return notes;
}

/** Move one note by whole semitones, leaving every other note alone. */
export function moveNote(
  notes: readonly NoteEvent[],
  index: number,
  semitones: number
): NoteEvent[] {
  if (index < 0 || index >= notes.length || semitones === 0) {
    return [...notes];
  }
  return notes.map((n, i) =>
    i === index
      ? { ...n, midi: Math.round(n.midi + semitones), cents: 0 }
      : n
  );
}
