/**
 * Showing a take as it was sung, or as it was written down.
 *
 * The same distinction playback draws (INV-NOTES-026), applied to what is
 * drawn rather than to what is sounded. Seen as sung, a note sits where it was
 * sung and says how far off centre it was; seen as written, it sits on the
 * grid at a notated length, because that is what a reader would play.
 *
 * The eye needs the choice for its own reason: a snap onto the wrong step is
 * plain in the picture and all but inaudible in a short take, so the quantizer
 * is only judgeable once its output can be looked at beside the performance.
 *
 * Pure, dependency-free.
 */
import type { NoteEvent } from './segmentation';
import type { QuantizedNote } from './quantize';
import type { PlaybackMode } from './playback';

/**
 * Which reading of a take is on screen.
 *
 * Deliberately the same vocabulary playback uses: two names for one
 * distinction would leave 'as-written' and 'as-notated' drifting apart.
 */
export type NotationView = PlaybackMode;

/**
 * As written down: onsets on the grid, lengths in whole steps, no cents.
 *
 * Cents are zeroed rather than carried over. Notation has no way to say a note
 * was fourteen cents flat, and showing the sung deviation beside a snapped
 * onset would draw a note that is on the grid and off centre at once.
 */
export function notesAsWritten(
  quantized: readonly QuantizedNote[]
): NoteEvent[] {
  return quantized.map((note) => ({
    midi: Math.round(note.midi),
    startMs: note.gridStartMs,
    endMs: note.gridStartMs + note.gridDurationMs,
    durationMs: note.gridDurationMs,
    cents: 0,
    clarity: note.clarity
  }));
}

/**
 * Whichever reading was asked for.
 *
 * Falls back to what was sung when there is no grid to write against: a take
 * too short or too free to fit a pulse still has a shape worth seeing, and
 * refusing to draw it would be worse than drawing it honestly.
 */
export function shownNotes(
  notes: readonly NoteEvent[],
  quantized: readonly QuantizedNote[] | null,
  view: NotationView
): NoteEvent[] {
  if (view === 'as-notated' && quantized && quantized.length > 0) {
    return notesAsWritten(quantized);
  }
  return notes.slice();
}
