/**
 * Reading a take according to what it was recorded as.
 *
 * The first take of an idea is a person switching between humming and
 * drumming without announcing it, so it has to be read both ways and guessed
 * at. A track recorded deliberately as a bass line is all notes; one recorded
 * as drums is all hits. Knowing which is worth more than any amount of
 * cleverness on ambiguous input: told that a track is drums, the reader can
 * stop asking whether each sound might have been a note, and every borderline
 * case resolves the right way instead of being argued about (INV-NOTES-115).
 *
 * So the role is not a label on the recording. It is the instruction for how
 * to read it, and the mixed reading is the one that has to be best-effort
 * because it is the only one nobody declared.
 */
import { dropTooBriefToSing, mergeBends } from './bends';
import { readPercussion, type Hit, type PercussionOptions } from './percussion';
import {
  segmentNotes,
  type NoteEvent,
  type PitchFrame,
  type SegmentOptions
} from './segmentation';
import { smoothPitch } from './smoothing';

/**
 * What a recording was made as.
 *
 * `mixed` is the first take of an idea, where both may appear. The others are
 * declared, and being declared is the whole point of them.
 */
export type TakeRole = 'mixed' | 'melody' | 'bass' | 'drums';

export interface Reading {
  notes: NoteEvent[];
  hits: Hit[];
}

export interface ReadOptions {
  segment?: SegmentOptions;
  percussion?: PercussionOptions;
}

/** Whether this role has notes in it at all. */
export const rolePlaysNotes = (role: TakeRole): boolean => role !== 'drums';

/** Whether this role has hits in it at all. */
export const rolePlaysHits = (role: TakeRole): boolean =>
  role === 'drums' || role === 'mixed';

/**
 * A track known to be drums has nothing to lose by looking for quieter and
 * longer hits than a mixed take dares to, because there is no singing for it
 * to mistake them for.
 */
const DECLARED_DRUMS: PercussionOptions = {
  minLevelDb: -55,
  maxDurationMs: 220,
  maxClarity: 0.8
};

export function readTake(
  frames: readonly PitchFrame[],
  role: TakeRole,
  options: ReadOptions = {}
): Reading {
  const notes = rolePlaysNotes(role)
    ? dropTooBriefToSing(
        mergeBends(segmentNotes(smoothPitch([...frames]), options.segment))
      )
    : [];
  const hits = rolePlaysHits(role)
    ? readPercussion(frames, {
        ...(role === 'drums' ? DECLARED_DRUMS : {}),
        ...options.percussion
      })
    : [];
  return { notes, hits };
}
