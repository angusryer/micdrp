/**
 * The reading a take had before it was read again (INV-NOTES-215).
 *
 * Reading again overwrote the melody, the hits and the summary with no way
 * back. Every threshold the reader uses is set once for the app rather than
 * per take, so a tuning arrived at against a recent close-sung take is what
 * an old quiet one gets read with — and the result can be worse in a way
 * nothing warns about, because "better" is a judgement only the person who
 * sang it can make.
 *
 * Kept on the device rather than with the note: it is a way back from
 * something done here, not a fact about the take, and it should not travel
 * to another device as though it were one.
 */
import { getJSON, remove, setJSON } from '../data/store';

/** What a reading is, as much of it as putting one back requires. */
export interface KeptReading {
  melody: readonly unknown[];
  hits: readonly unknown[];
  analysisVersion: number;
  summary?: Record<string, unknown>;
  /**
   * The thresholds that reading was made with (INV-NOTES-216).
   *
   * Kept with it, because putting a reading back without the settings that
   * produced it leaves a take stamped with numbers that did not make what
   * it now holds — and the next reading would silently disagree with the
   * one on screen.
   */
  readWith?: Record<string, number>;
}

const keyFor = (noteId: string) => `notes.${noteId}.previousReading`;

/**
 * Keep what a take reads as now, before it is read again.
 *
 * One deep only. A second re-read replaces the first's way back, because
 * the answer to "put it back" is the reading you were looking at, not one
 * from further up a stack nobody is keeping track of.
 */
export function keepReading(noteId: string, reading: KeptReading): void {
  setJSON(keyFor(noteId), reading);
}

/** The reading kept for this take, or null where none was. */
export function keptReading(noteId: string): KeptReading | null {
  const kept = getJSON<KeptReading>(keyFor(noteId));
  return kept != null && Array.isArray(kept.melody) ? kept : null;
}

/** Forget the way back, once it has been taken or is no longer wanted. */
export function forgetKeptReading(noteId: string): void {
  remove(keyFor(noteId));
}
