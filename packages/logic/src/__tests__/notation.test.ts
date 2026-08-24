/**
 * Seeing a take as sung or as written down — INV-NOTES-026.
 *
 * The written reading is only worth drawing if it is genuinely the notation
 * and not a redraw of the performance, so what is asserted here is that the
 * onsets move onto the grid and the cents stop being reported.
 */
import { notesAsWritten, shownNotes } from '../notation';
import { quantize } from '../quantize';
import type { NoteEvent } from '../segmentation';

/** A note sung a little late and a little flat. */
const sung: NoteEvent[] = [
  { midi: 60, startMs: 12, endMs: 505, durationMs: 493, cents: -18, clarity: 0.9, loudnessDb: null },
  { midi: 62, startMs: 507, endMs: 1010, durationMs: 503, cents: 11, clarity: 0.9, loudnessDb: null },
  { midi: 64, startMs: 1013, endMs: 1495, durationMs: 482, cents: -6, clarity: 0.9, loudnessDb: null },
  { midi: 65, startMs: 1502, endMs: 2000, durationMs: 498, cents: 4, clarity: 0.9, loudnessDb: null }
];

describe('shownNotes', () => {
  it('as sung, draws the take exactly as it was detected', () => {
    expect(shownNotes(sung, quantize(sung).notes, 'as-sung')).toEqual(sung);
  });

  it('as written, puts every onset on the grid', () => {
    const { notes: quantized } = quantize(sung);
    const written = shownNotes(sung, quantized, 'as-notated');
    written.forEach((note, i) => {
      expect(note.startMs).toBe(quantized[i].gridStartMs);
      expect(note.endMs - note.startMs).toBe(quantized[i].gridDurationMs);
    });
  });

  it('as written, reports no cents — notation cannot say a note was flat', () => {
    const written = notesAsWritten(quantize(sung).notes);
    expect(written.every((note) => note.cents === 0)).toBe(true);
    // The pitch itself is untouched: only the deviation from it is dropped.
    expect(written.map((note) => note.midi)).toEqual(sung.map((n) => n.midi));
  });

  it('the two readings differ for a take that was neither in tune nor in time', () => {
    const { notes: quantized } = quantize(sung);
    expect(shownNotes(sung, quantized, 'as-notated')).not.toEqual(
      shownNotes(sung, quantized, 'as-sung')
    );
  });

  it('falls back to what was sung when there is no grid to write against', () => {
    expect(shownNotes(sung, [], 'as-notated')).toEqual(sung);
    expect(shownNotes(sung, null, 'as-notated')).toEqual(sung);
  });

  it('never rewrites the stored melody', () => {
    const before = JSON.stringify(sung);
    shownNotes(sung, quantize(sung).notes, 'as-notated');
    expect(JSON.stringify(sung)).toBe(before);
  });
});
