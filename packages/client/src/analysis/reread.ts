/**
 * Reading a take again, with whatever the engine can do now.
 *
 * A take has exactly two things that cannot be produced again: the recording,
 * and what a person did to it. The melody, the hits, the chords, the grid, the
 * key and the tempo are readings of the first — so an engine that got better
 * is only useful to the takes already in the library if those readings can be
 * thrown away and made afresh (INV-NOTES-116).
 *
 * The interpretation is not touched. Edits are anchored to the moment the
 * detector originally heard them (INV-NOTES-096), so they replay against the
 * new reading on their own; an edit whose note is no longer there simply finds
 * nothing, which is the honest outcome and the thing worth warning about.
 */
import { ANALYSIS_VERSION, readTake, type TakeRole } from 'logic';
import type { HitDto, NoteEventDto } from 'shared';

import { audioEngine } from '../audio/AudioEngine';
import { localCopyOf } from './localCopy';
import { readingOptions } from './readingValues';

export interface Reread {
  melody: NoteEventDto[];
  hits: HitDto[];
  analysisVersion: number;
}

/**
 * Why a reading did not happen, when one did not (INV-NOTES-184).
 *
 * Two outcomes, because they call for different things: a take with no
 * recording behind it will never be readable, and a recording that would not
 * open might on the next attempt.
 */
export type RereadFailure = 'no-recording' | 'unreadable';

export type RereadResult =
  | { ok: true; reading: Reread }
  | { ok: false; because: RereadFailure };

/**
 * Re-read one recording.
 *
 * Says which way it failed rather than only that it did: "there is no
 * recording" and "the recording would not open" call for different things,
 * and neither should replace what is already stored (INV-NOTES-184).
 */
export async function rereadTake(
  audioUri: string | null,
  role: TakeRole = 'mixed'
): Promise<RereadResult> {
  if (audioUri == null || audioUri.length === 0) {
    return { ok: false, because: 'no-recording' };
  }
  // The analyser opens local files only, so a take held on the server is
  // fetched to a scratch file first (INV-NOTES-185).
  const copy = await localCopyOf(audioUri);
  if (copy == null) {
    return { ok: false, because: 'no-recording' };
  }
  let samples;
  try {
    samples = await audioEngine.analyzeFile(copy.path);
  } finally {
    // However the reading ended. A scratch file that outlives its reading is
    // a recording of somebody's take left in a temporary directory.
    await copy.release();
  }
  if (samples.length === 0) {
    return { ok: false, because: 'unreadable' };
  }
  // Every threshold the reading turns on, as it is currently set
  // (INV-NOTES-172).
  const { notes, hits } = readTake(samples, role, readingOptions());
  // The DTOs mirror the logic types field-for-field on purpose, so this is a
  // rename rather than a conversion (see shared/dto/note).
  return {
    ok: true,
    reading: { melody: notes, hits, analysisVersion: ANALYSIS_VERSION }
  };
}
