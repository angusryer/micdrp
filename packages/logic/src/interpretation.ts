/**
 * A person's decisions about a take, kept apart from what analysis inferred.
 *
 * The melody is the source of truth and the analysis is derived from it, so
 * storing the analysis would create a second source that goes stale the moment
 * detection improves (Axiom 2, INV-NOTES-022). What is stored instead is only
 * what someone overrode; inference runs first and these land on top of it.
 *
 * Two functions, and they are inverses: `collectEdits` reduces a progression
 * to its differences, `replayEdits` puts them back. Round-tripping is the
 * property that makes the whole arrangement safe, and it is tested directly.
 */
import { setChord, type ChordSlot } from './harmony';
import type { KeyEstimate } from './key';

/**
 * One chord a person chose, anchored to a moment rather than to a bar.
 *
 * Time, not bar number, because bar boundaries are themselves editable: an
 * edit tied to "bar 3" would silently move when a bar line did, while the
 * audio and the beats underneath it never move.
 */
export interface ChordSlotEdit {
  /** A time inside the slot this applies to. */
  atMs: number;
  rootPc: number;
  quality: ChordSlot['quality'];
}

/** Whether a time falls inside a slot. End-exclusive so slots cannot overlap. */
function covers(slot: ChordSlot, atMs: number): boolean {
  return atMs >= slot.startMs && atMs < slot.endMs;
}

/**
 * Reduce a progression to just the differences, which is what gets stored.
 *
 * The anchor is the slot's own start. Any time inside would do, but the start
 * is the one that stays meaningful if the slot is later shortened.
 */
export function collectEdits(slots: readonly ChordSlot[]): ChordSlotEdit[] {
  const edits: ChordSlotEdit[] = [];
  for (const slot of slots) {
    if (slot.isEdited) {
      edits.push({ atMs: slot.startMs, rootPc: slot.rootPc, quality: slot.quality });
    }
  }
  return edits;
}

/**
 * Put a person's decisions back on top of freshly inferred chords.
 *
 * An edit whose anchor lands in no slot is dropped rather than guessed at.
 * That happens when the analysis now produces a shorter take or different
 * slot boundaries, and inventing a home for it would put someone's chord
 * somewhere they never placed it.
 */
export function replayEdits(
  inferred: readonly ChordSlot[],
  edits: readonly ChordSlotEdit[],
  key: KeyEstimate
): ChordSlot[] {
  const slots = inferred.map((slot) => ({ ...slot }));
  for (const edit of edits) {
    const index = slots.findIndex((slot) => covers(slot, edit.atMs));
    if (index === -1) {
      continue;
    }
    slots[index] = setChord(slots[index], key, edit.rootPc, edit.quality);
  }
  return slots;
}
