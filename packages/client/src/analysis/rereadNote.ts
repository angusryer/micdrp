/**
 * Reading a take again, from wherever it is asked for (INV-NOTES-262).
 *
 * One path for the note's own screen and for the list of notes, so the two
 * cannot drift: the same audio is chosen the same way (INV-NOTES-183), the
 * same thresholds are used (INV-NOTES-216), the previous reading is kept
 * the same way (INV-NOTES-215) and the same thing is written back.
 *
 * And one answer to "would it change anything?", asked before anything is
 * read. A control that reads a take again when nothing would change teaches
 * a person that re-reading is noise — so the app has to know the difference
 * before the press, not after (INV-NOTES-261).
 */
import { isStale } from 'logic';

import { cacheReading } from '../data/notesSync';
import type { NoteMeta } from '../data/notesCache';
import { notesRepo } from '../data/notesRepo';
import { hasTakeAudio } from '../data/takeAudio';
import { keepReading } from './keptReading';
import { rereadTake, type RereadFailure } from './reread';
import { currentReadWith, stampReadWith, takeReadWith } from './takeKnobs';

/** Why a re-read would give something different — or that it would not. */
export type RereadChange = 'stale' | 'retuned' | 'unchanged';

const sameValues = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/**
 * Which of three things is true of a take: read by an older listener, read
 * with thresholds since changed, or exactly what a re-read would give.
 *
 * Stale first, because a newer listener changes the reading whatever the
 * thresholds say. Thresholds compared against what a reading made now would
 * be stamped with — the same values, read rather than written.
 */
export function rereadChange(note: NoteMeta): RereadChange {
  if (isStale(note.analysisVersion)) {
    return 'stale';
  }
  const was = note.readWith ?? takeReadWith(note.id);
  // A take that carries no thresholds was read before any were stamped, and
  // nothing can say what it was read with — so it is retuned by definition.
  if (Object.keys(was).length === 0) {
    return 'retuned';
  }
  return sameValues(was, currentReadWith(note.id)) ? 'unchanged' : 'retuned';
}

/** Where the take's audio is, by the rule every reader of it uses. */
async function audioFor(note: NoteMeta): Promise<string | null> {
  if (!hasTakeAudio(note)) {
    return null;
  }
  return note.localAudioUri ?? notesRepo.audioUrlFor(note.id, note.audioPath);
}

/**
 * Read the take again and write the reading back. Null on success, else
 * why it failed (INV-NOTES-184). Nothing is replaced on failure.
 */
export async function rereadNote(note: NoteMeta): Promise<RereadFailure | null> {
  const readWith = takeReadWith(note.id);
  let outcome = await rereadTake(await audioFor(note), 'mixed', readWith);
  // A local copy that is no longer there — every take after a reinstall —
  // falls back to the uploaded one rather than failing (INV-NOTES-185).
  if (!outcome.ok && note.audioPath != null && note.localAudioUri != null) {
    outcome = await rereadTake(
      await notesRepo.audioUrlFor(note.id, note.audioPath),
      'mixed',
      readWith
    );
  }
  if (!outcome.ok) {
    return outcome.because;
  }
  // Kept before anything is overwritten (INV-NOTES-215).
  keepReading(note.id, {
    melody: note.melody ?? [],
    hits: note.hits ?? [],
    analysisVersion: note.analysisVersion ?? 0,
    readWith
  });
  const measured = outcome.reading.summary;
  cacheReading(note.id, {
    ...outcome.reading,
    summary:
      measured == null
        ? undefined
        : {
            ...measured,
            key: measured.key ?? undefined,
            tempoBpm: measured.tempoBpm ?? undefined,
            inTuneRatio: measured.inTuneRatio ?? undefined,
            meanCentsError: measured.meanCentsError ?? undefined,
            rangeLowMidi: measured.rangeLowMidi ?? undefined,
            rangeHighMidi: measured.rangeHighMidi ?? undefined
          }
  });
  await notesRepo.saveReading(note.id, {
    ...outcome.reading,
    readWith: stampReadWith(note.id)
  });
  return null;
}
