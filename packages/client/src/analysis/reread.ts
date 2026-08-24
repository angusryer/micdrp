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
import { segmentOptions } from './segmentSettings';

export interface Reread {
  melody: NoteEventDto[];
  hits: HitDto[];
  analysisVersion: number;
}

/**
 * Re-read one recording.
 *
 * Null when there is nothing to read — no audio, or an engine that cannot
 * open it. Null rather than an empty reading, because "the file would not
 * open" and "the take is silent" are different answers and only one of them
 * should replace what is already stored.
 */
export async function rereadTake(
  audioUri: string | null,
  role: TakeRole = 'mixed'
): Promise<Reread | null> {
  if (audioUri == null || audioUri.length === 0) {
    return null;
  }
  const samples = await audioEngine.analyzeFile(audioUri);
  if (samples.length === 0) {
    return null;
  }
  const { notes, hits } = readTake(samples, role, {
    segment: segmentOptions()
  });
  // The DTOs mirror the logic types field-for-field on purpose, so this is a
  // rename rather than a conversion (see shared/dto/note).
  return { melody: notes, hits, analysisVersion: ANALYSIS_VERSION };
}
