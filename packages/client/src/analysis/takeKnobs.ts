/**
 * The thresholds one take is read with (INV-NOTES-216).
 *
 * Every number the reader turns on lived once for the whole app. So a
 * recording made in August was read again with a tuning arrived at in
 * September against a different take — sung differently, at a different
 * distance from the microphone — and came back as a different melody, with
 * nothing anywhere to say it had been read under settings never chosen for
 * it. The person is told the engine improved; what actually changed was a
 * number they moved while looking at something else.
 *
 * So a take carries its own. The app-wide values are where a NEW take
 * starts, not what every old one is retroactively subject to.
 *
 * Held on the device and stamped onto the note when it is read, rather than
 * only one or the other: turning a knob has to answer instantly and a round
 * trip cannot, while a value that never left the phone would be lost on the
 * next reinstall — which is exactly when a library gets read again.
 */
import { getJSON, remove, setJSON } from '../data/store';

import { DECLARED_KNOBS, type ReadingKnob } from './readingKnobs';
import { knobValue as globalKnobValue } from './readingValues';

/**
 * What a take was read with: knob name to value, flat.
 *
 * Flat and keyed by `group.key` so a knob added or taken out of the table
 * later leaves a stamp readable rather than malformed. Sparse: only what
 * was deliberately set for this take is here, and everything absent means
 * "whatever the app said", which is what a take read before this existed
 * has for all of them.
 */
export type ReadWith = Record<string, number>;

const nameOf = (knob: ReadingKnob) => `${knob.group}.${knob.key}`;
const keyFor = (noteId: string) => `notes.${noteId}.readWith`;

/** The values stored for this take, empty where none are. */
export function takeReadWith(noteId: string): ReadWith {
  const stored = getJSON<ReadWith>(keyFor(noteId));
  if (stored == null || typeof stored !== 'object' || Array.isArray(stored)) {
    return {};
  }
  const out: ReadWith = {};
  for (const [name, value] of Object.entries(stored)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[name] = value;
    }
  }
  return out;
}

/**
 * What this knob is set to for this take.
 *
 * Falls back to the app-wide value, because a take read before it carried
 * its own settings has nothing better to fall back to.
 */
export function takeKnobValue(noteId: string, knob: ReadingKnob): number {
  const mine = takeReadWith(noteId)[nameOf(knob)];
  return typeof mine === 'number'
    ? Math.min(Math.max(mine, knob.min), knob.max)
    : globalKnobValue(knob);
}

/** Set it for this take alone. Out-of-range values are brought into range. */
export function setTakeKnobValue(
  noteId: string,
  knob: ReadingKnob,
  value: number
): number {
  const next = Math.min(Math.max(value, knob.min), knob.max);
  setJSON(keyFor(noteId), { ...takeReadWith(noteId), [nameOf(knob)]: next });
  return next;
}

/**
 * Stamp what a take was just read with.
 *
 * Every knob, not only the ones deliberately turned: the point is that the
 * next reading matches this one, and a knob left to the app-wide value is
 * as much a part of how it was read as one that was moved.
 */
export function stampReadWith(noteId: string): ReadWith {
  const stamp: ReadWith = {};
  for (const knob of DECLARED_KNOBS) {
    stamp[nameOf(knob)] = takeKnobValue(noteId, knob);
  }
  setJSON(keyFor(noteId), stamp);
  return stamp;
}

/**
 * Take the settings a note arrived carrying, where this device has none.
 *
 * Never overwrites: what is on the device is the working copy, and the
 * stamp on the note is a record of a reading that has already happened.
 */
export function seedReadWith(noteId: string, stamped: unknown): void {
  if (stamped == null || typeof stamped !== 'object') {
    return;
  }
  if (Object.keys(takeReadWith(noteId)).length > 0) {
    return;
  }
  setJSON(keyFor(noteId), stamped as ReadWith);
}

/**
 * Put back the settings a reading was made under.
 *
 * Unlike {@link seedReadWith} this overwrites: undoing a reading means
 * undoing what it was read with, not merging the two.
 */
export function restoreReadWith(noteId: string, readWith: ReadWith): void {
  setJSON(keyFor(noteId), readWith);
}

/** Put this take back on the app-wide settings. */
export function resetTakeKnobs(noteId: string): void {
  remove(keyFor(noteId));
}

/** Whether this take has settings of its own at all. */
export function hasTakeKnobs(noteId: string): boolean {
  return Object.keys(takeReadWith(noteId)).length > 0;
}
