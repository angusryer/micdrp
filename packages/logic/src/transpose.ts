/**
 * Moving a melody into a register that can actually be heard.
 *
 * A phone speaker has almost nothing in the low register, so a line sung down
 * there is inaudible on one and cannot be judged at all. Lifting it by whole
 * octaves keeps every interval and every relationship intact — it is the same
 * tune, somewhere you can hear it.
 *
 * Whole octaves and nothing else. A shift of any other size changes what the
 * melody is against the chords read from it; an octave changes only where it
 * sits. And this touches playback alone: what was sung was sung where it was
 * sung, and a convenience for listening must never become the record
 * (INV-NOTES-058).
 *
 * Pure, dependency-free.
 */
import type { TargetNote } from './scoring';

export const SEMITONES_PER_OCTAVE = 12;

/** The range MIDI itself allows. */
export const MIN_MIDI = 0;
export const MAX_MIDI = 127;

/**
 * How far a melody can be moved before a note would leave MIDI range.
 *
 * Refusing is the right failure here. Clamping the notes that would fall off
 * the end while the rest moved would flatten the intervals and play something
 * that was never sung, which is the one thing playback must not do
 * (INV-NOTES-059).
 *
 * An empty melody has nothing to push out of range, so it gets the full
 * allowance rather than none — there is no reason for the control to be dead.
 */
export function octaveRoom(
  midis: readonly number[],
  limit: number
): { down: number; up: number } {
  if (midis.length === 0) {
    return { down: limit, up: limit };
  }
  let lowest = Infinity;
  let highest = -Infinity;
  for (const midi of midis) {
    lowest = Math.min(lowest, midi);
    highest = Math.max(highest, midi);
  }
  const down = Math.floor((lowest - MIN_MIDI) / SEMITONES_PER_OCTAVE);
  const up = Math.floor((MAX_MIDI - highest) / SEMITONES_PER_OCTAVE);
  return {
    down: Math.max(0, Math.min(limit, down)),
    up: Math.max(0, Math.min(limit, up))
  };
}

/**
 * The same notes, whole octaves away.
 *
 * Fractional MIDI passes through untouched but for the shift, so a take heard
 * as sung keeps its cents: moving a register is not an excuse to quietly
 * start rounding (INV-NOTES-026).
 */
export function transposeTargets(
  targets: readonly TargetNote[],
  octaves: number
): TargetNote[] {
  if (octaves === 0) {
    return targets as TargetNote[];
  }
  const shift = octaves * SEMITONES_PER_OCTAVE;
  return targets.map((target) => ({ ...target, midi: target.midi + shift }));
}

/** One pitch, the same distance. Tapping a note has to agree with playing it. */
export function transposeMidi(midi: number, octaves: number): number {
  return midi + octaves * SEMITONES_PER_OCTAVE;
}

/** How the offset reads on the graph: "+1", "-2", and nothing at all at rest. */
export function octaveLabel(octaves: number): string | null {
  if (octaves === 0) {
    return null;
  }
  return octaves > 0 ? `+${octaves}` : `${octaves}`;
}
