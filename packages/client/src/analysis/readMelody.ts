/**
 * The one way this app turns pitch frames into notes (INV-PITCH-028).
 *
 * There were five, and no two agreed. A capture applied the segment knobs
 * and re-centred; a re-read applied smooth, segment, bends and
 * articulation and did not re-centre; a layer did a third thing; practice
 * feedback and the results screen each did a fourth and a fifth.
 *
 * So the re-read button — the one offered for tuning a detector — did not
 * run the pipeline that produced the reading being tuned, and the smooth
 * and bend knobs the panel puts first reached a re-read and nothing else.
 * One shared take came back as 26 notes read one way and 35 read the
 * other, from the same recording. Which is right is worth arguing about;
 * that the same audio answers it twice is not.
 */
import { readTake, recentreNotes, type Hit, type NoteEvent, type PitchFrame, type TakeRole } from 'logic';

import { readingOptions } from './readingValues';

export interface Melody {
  notes: NoteEvent[];
  hits: Hit[];
}

/**
 * Read frames as notes, with every knob as it is currently set.
 *
 * Re-centring is part of reading rather than something a caller adds
 * afterwards: a take sitting near a semitone boundary otherwise splits one
 * scale degree across two semitones, and the key estimate — and the
 * harmony built on it — inherits that (INV-PITCH-013). A caller that
 * forgot it got a different melody from one that did not, which is exactly
 * the drift this module exists to end.
 */
export function readMelody(
  frames: readonly PitchFrame[],
  role: TakeRole = 'mixed'
): Melody {
  const { notes, hits } = readTake(frames, role, readingOptions());
  // Only notes have a centre — a struck sound has no pitch to recentre.
  return { notes: recentreNotes(notes).notes, hits };
}
