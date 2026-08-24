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
  /**
   * A time inside the note this applies to, as the detector heard it.
   *
   * The stored reading is what edits replay over, so this is anchored to
   * something that does not move. Anchoring to the edited time would make the
   * anchor and the value the same quantity: move a note, and its own edit
   * could no longer find it (INV-NOTES-096).
   */
  atMs: number;
  /** The pitch it should have been, when that is what changed. */
  midi?: number;
  /** When it should have begun and ended, when that is what changed. */
  startMs?: number;
  endMs?: number;
}

/** The shortest a note may be made. Below this it is a click, not a note. */
export const MIN_NOTE_MS = 60;

/**
 * Change the length of some notes, leaving every other note where it is.
 *
 * Only the chosen notes move. Pushing the notes after them along — rippling —
 * was tried and is worse to use: every small change to one note rearranged
 * the rest of the phrase, so a length you were happy with kept sliding away
 * from you while you worked on the one before it (INV-NOTES-095).
 *
 * Overlaps are allowed to happen here and settled at replay, where a note
 * running into its neighbour either joins it or stops against it. Doing it
 * here would change how many notes there are, and the edits are paired with
 * what was heard by position — so the count has to survive this step.
 */
/** Which end of a note is being pulled. */
export type NoteEdge = 'start' | 'end';

export function resizeNotes(
  notes: readonly NoteEvent[],
  chosen: readonly number[],
  deltaMs: number,
  edge: NoteEdge = 'end'
): NoteEvent[] {
  const wanted = new Set(chosen);
  return notes.map((note, i) => {
    if (!wanted.has(i)) {
      return note;
    }
    // Never shorter than a note can be: past that it is a click, and a
    // length of nothing is not an edit anybody meant.
    const length = Math.max(MIN_NOTE_MS, note.endMs - note.startMs + deltaMs);
    if (edge === 'end') {
      // Held at a neighbour of another pitch. Clamped here, where which note
      // is being pulled is known — settling later can only guess, and would
      // shorten whichever came first (INV-NOTES-095).
      const after = notes[i + 1];
      const limit =
        after && Math.round(after.midi) !== Math.round(note.midi)
          ? after.startMs
          : Infinity;
      const endMs = Math.min(note.startMs + length, limit);
      return { ...note, endMs, durationMs: endMs - note.startMs };
    }
    const before = notes[i - 1];
    const floor =
      before && Math.round(before.midi) !== Math.round(note.midi)
        ? before.endMs
        : -Infinity;
    const startMs = Math.max(note.endMs - length, floor);
    return { ...note, startMs, durationMs: note.endMs - startMs };
  });
}

/**
 * What happens when a note is lengthened into the one after it.
 *
 * Same pitch: they join. That is what the gesture means — two notes at one
 * pitch, run together, is a singer saying the detector split a held note in
 * two (INV-NOTES-095).
 *
 * Different pitch: it stops at the neighbour. Swallowing a note of another
 * pitch would delete a note nobody asked to delete, and there is no reading of
 * "make this longer" that means "and remove that". To take the room, the
 * neighbour has to be shortened first, deliberately, which is one more step
 * and the right number of steps for destroying something.
 *
 * Either way no two notes overlap: a moment belongs to exactly one note, which
 * is what lets an edit anchor to a moment inside one and lets the harmony read
 * a span.
 */
export function settleOverlaps(notes: readonly NoteEvent[]): NoteEvent[] {
  const settled: NoteEvent[] = [];
  for (const note of [...notes].sort((a, b) => a.startMs - b.startMs)) {
    const last = settled[settled.length - 1];
    if (!last || note.startMs >= last.endMs) {
      settled.push(note);
      continue;
    }
    if (Math.round(last.midi) === Math.round(note.midi)) {
      // Nothing audible is lost: the join runs to whichever ended later.
      const endMs = Math.max(last.endMs, note.endMs);
      settled[settled.length - 1] = {
        ...last,
        endMs,
        durationMs: endMs - last.startMs
      };
      continue;
    }
    // Held back to where its neighbour begins, and the neighbour untouched.
    settled[settled.length - 1] = {
      ...last,
      endMs: note.startMs,
      durationMs: note.startMs - last.startMs
    };
    settled.push(note);
  }
  return settled;
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
    const was = heard[i];
    const now = corrected[i];
    const movedPitch = now.midi !== was.midi;
    const movedTime =
      now.startMs !== was.startMs || now.endMs !== was.endMs;
    if (!movedPitch && !movedTime) {
      continue;
    }
    // One edit per note, whatever changed about it: two would mean deciding
    // which wins on replay.
    edits.push({
      atMs: was.startMs,
      ...(movedPitch ? { midi: now.midi } : {}),
      ...(movedTime ? { startMs: now.startMs, endMs: now.endMs } : {})
    });
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
    // Searched against what was heard, never against what has already been
    // edited. An edit that lengthens a note moves the note after it, and
    // hunting the mutated array would then find the *lengthened* note for the
    // next edit's anchor — every later edit landing one note early
    // (INV-NOTES-096).
    const index = heard.findIndex((n) => covers(n, edit.atMs));
    if (index === -1) {
      continue;
    }
    const note = notes[index];
    notes[index] = {
      ...note,
      // Cents are cleared only where the pitch was chosen: they described
      // where the voice sat against a pitch nobody is claiming any more.
      ...(edit.midi != null
        ? { midi: Math.round(edit.midi), cents: 0 }
        : {}),
      ...(edit.startMs != null && edit.endMs != null
        ? {
            startMs: edit.startMs,
            endMs: edit.endMs,
            durationMs: edit.endMs - edit.startMs
          }
        : {})
    };
  }
  // A note lengthened over its neighbour joins it at the same pitch and stops
  // against a different one (INV-NOTES-095). Resolved here, so nothing
  // upstream has to think about overlap and the edits stay paired with what
  // was heard.
  return settleOverlaps(notes);
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
