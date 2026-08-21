/**
 * Hearing a take back, either as it was sung or as it was written down.
 *
 * Two different questions, and conflating them hides both. Heard as sung, a
 * mismatch is the detector's fault and worth chasing. Heard as written, a
 * mismatch is what transcription costs: a pure major third is fourteen cents
 * from a tempered one, and no amount of better detection changes that
 * (INV-NOTES-026).
 *
 * Without the distinction every complaint about playback is ambiguous between
 * the two, which is why the pitch detector has been hard to judge.
 *
 * Pure, dependency-free.
 */
import type { NoteEvent } from './segmentation';
import type { QuantizedNote } from './quantize';
import type { TargetNote } from './scoring';

export type PlaybackMode = 'as-sung' | 'as-notated';

/**
 * As sung: the pitch that was detected, at the moment it was detected.
 *
 * Fractional MIDI, so the cents are kept. Nothing here rounds or snaps —
 * that is the whole point, and it is what makes a wrong note audibly the
 * detector's doing rather than notation's.
 */
export function asSung(notes: readonly NoteEvent[]): TargetNote[] {
  return notes.map((note) => ({
    midi: note.midi + note.cents / 100,
    startMs: note.startMs,
    endMs: note.endMs
  }));
}

/**
 * As written down: the notated pitch, on the notated grid.
 *
 * What a player reading the transcription would produce, which is the thing
 * worth checking when the question is whether the notation is right.
 */
export function asNotated(notes: readonly QuantizedNote[]): TargetNote[] {
  return notes.map((note) => ({
    midi: Math.round(note.midi),
    startMs: note.gridStartMs,
    endMs: note.gridStartMs + note.gridDurationMs
  }));
}

/**
 * Whichever was asked for.
 *
 * Falls back to what was sung when there is no grid to notate against: a take
 * too short or too free to fit a pulse still has a pitch, and refusing to
 * play it would be worse than playing it honestly.
 */
export function playbackTargets(
  notes: readonly NoteEvent[],
  quantized: readonly QuantizedNote[] | null,
  mode: PlaybackMode
): TargetNote[] {
  if (mode === 'as-notated' && quantized && quantized.length > 0) {
    return asNotated(quantized);
  }
  return asSung(notes);
}
