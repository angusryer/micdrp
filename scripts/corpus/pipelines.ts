/**
 * How the app reads a recording, and how it used to.
 *
 * There were five readers once and no two agreed — a capture applied the
 * segment knobs and re-centred, a re-read applied smooth, segment, bends
 * and articulation and did not, a layer did a third thing. One recording
 * came back as 26 notes read one way and 35 read the other. They are one
 * function now (INV-PITCH-028).
 *
 * `whatItWas` is kept so that unification stays visible in the numbers
 * rather than only in the history: run both and the gap it closed is
 * still there to read.
 */
import { logic, type NoteEvent, type PitchFrame, type ReadOptions } from './logic.ts';

/** What a capture did before the readers were merged: segment knobs only. */
export function whatItWas(
  frames: readonly PitchFrame[],
  segment: Record<string, number> = {}
): NoteEvent[] {
  const smoothed = logic.smoothPitch([...frames]);
  const { notes } = logic.recentreNotes(
    logic.dropTooBriefToSing(logic.mergeBends(logic.segmentNotes(smoothed, segment)))
  );
  return notes;
}

/** What every path does now: every knob, and re-centring (INV-PITCH-028). */
export function appReading(
  frames: readonly PitchFrame[],
  options: ReadOptions = {}
): NoteEvent[] {
  return logic.recentreNotes(logic.readTake(frames, 'mixed', options).notes).notes;
}
