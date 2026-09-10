/**
 * Notes written into a take rather than sung (INV-NOTES-246).
 *
 * The first thing in this domain that adds to a take rather than reading
 * one. Nothing in the audio produced these and no re-read ever will, so
 * they are kept with the interpretation — where a decision about a take
 * lives — and merged into what was heard before anything else runs.
 *
 * Merged rather than handled apart, because every path downstream is
 * already written against one list of notes: replaying edits, collecting
 * them, quantising, drawing, exporting. An edit is anchored by the moment
 * it covers rather than by an index (INV-NOTES-096), so a written note
 * sitting in that list can be corrected, moved and resized like any other
 * with nothing else changed at all (INV-NOTES-247).
 */
import type { NoteEvent } from './segmentation';

/** What is kept of a written note: the least that can rebuild one. */
export interface WrittenNote {
  atMs: number;
  endMs: number;
  midi: number;
}

/**
 * The pitch and length carry everything a written note claims.
 *
 * Cents is zero because a written note is exactly the pitch it says: there
 * is no voice behind it sitting slightly sharp. Clarity is one for the same
 * reason — nothing was detected, so nothing is uncertain.
 */
export function noteFromWritten(one: WrittenNote): NoteEvent {
  const startMs = Math.max(0, one.atMs);
  const endMs = Math.max(startMs + 1, one.endMs);
  return {
    midi: Math.round(one.midi),
    startMs,
    endMs,
    durationMs: endMs - startMs,
    cents: 0,
    clarity: 1,
    loudnessDb: null,
    isWritten: true
  };
}

/**
 * What was heard and what was written, as one list in time order.
 *
 * Sorted by where each note starts, so the list reads as the take does and
 * every index-addressed thing above it keeps working.
 */
export function withWritten(
  heard: readonly NoteEvent[],
  written: readonly WrittenNote[]
): NoteEvent[] {
  if (written.length === 0) {
    return [...heard];
  }
  return [...heard, ...written.map(noteFromWritten)].sort(
    (a, b) => a.startMs - b.startMs
  );
}

/** How much of a beat a written note takes up when it is first placed. */
const SHARE_OF_BEAT = 0.25;

/**
 * A note written at the playhead (INV-NOTES-245).
 *
 * A quarter of the beat it sits in rather than a whole one: a note that is
 * too short is lengthened by dragging its end, which already works, while
 * one that is too long hides what is under it. Measured on the beat the
 * playhead is actually in, so it is a quarter beat in a take that breathes
 * too — with no beat to measure, a plain eighth of a second.
 */
export function writeAt(
  atMs: number,
  midi: number,
  beatMs: number
): WrittenNote {
  const length = beatMs > 0 ? beatMs * SHARE_OF_BEAT : 125;
  return {
    atMs: Math.max(0, atMs),
    endMs: Math.max(0, atMs) + length,
    midi: Math.round(midi)
  };
}

/** Throw away a written note, found by where it starts. */
export function unwrite(
  written: readonly WrittenNote[],
  atMs: number
): WrittenNote[] {
  return written.filter((one) => Math.round(one.atMs) !== Math.round(atMs));
}

/**
 * The notes left after the thrown-away ones (INV-NOTES-248).
 *
 * Applied before any edit is replayed, so nothing downstream ever sees a
 * deleted note: indices, corrections, quantising and the export all go on
 * reading one list and need to know nothing about this.
 *
 * A deletion cannot be an edit. Edits are collected by comparing what is on
 * screen against what was heard, note against note in order, and a missing
 * note shifts every anchor after it — so collecting them again would
 * rewrite every later correction onto the wrong note.
 *
 * Anchored the way an edit is: by a moment inside the note as it was heard
 * (INV-NOTES-096). A re-read moves an onset a little and a fixed instant
 * would let every deleted note back in, but the note is still around that
 * moment, so asking which note covers it finds the same one.
 */
export function withoutDeleted(
  notes: readonly NoteEvent[],
  deleted: readonly number[]
): NoteEvent[] {
  if (deleted.length === 0) {
    return [...notes];
  }
  return notes.filter(
    (note) =>
      !deleted.some((atMs) => atMs >= note.startMs && atMs < note.endMs)
  );
}

/** A moment inside this note, which is what a deletion is anchored to. */
export function anchorOf(note: NoteEvent): number {
  return note.startMs;
}
