/**
 * Writing a note to this device, before anything is sent anywhere.
 *
 * A take used to exist only if the round trip succeeded — the audio was
 * written to disk, the create was posted, and a failure left the recording
 * somewhere the app would never show again. For an app whose job is catching
 * an idea before it evaporates, that put the least reliable part of the phone
 * in the load-bearing position (INV-NOTES-139).
 *
 * So this is where a capture lands first. What was sung is a fact the moment
 * it was sung; where it ends up stored is a detail that can be retried.
 */
import type { CreateNoteInput } from 'shared';
import { NOTES_INDEX_KEY, listNotes, type NoteMeta } from './notesCache';
import { setJSON } from './store';

/** How a note made here is told apart from one the server named. */
const LOCAL_PREFIX = 'local-';

/** True where this id was minted on the device rather than by the server. */
export const isLocalId = (id: string): boolean => id.startsWith(LOCAL_PREFIX);

/**
 * An id for a note nobody else has seen.
 *
 * The moment it was created plus a little noise: two takes cannot share a
 * millisecond in practice, and an id that collided would silently merge two
 * recordings into one.
 */
export function localNoteId(createdAtMs: number, salt: string): string {
  return `${LOCAL_PREFIX}${createdAtMs}-${salt}`;
}

/** Write one note into the index, replacing any note already under its id. */
export function putNote(note: NoteMeta): void {
  const index: Record<string, NoteMeta> = {};
  for (const meta of listNotes()) {
    index[meta.id] = meta;
  }
  index[note.id] = note;
  setJSON(NOTES_INDEX_KEY, index);
}

/** Take one note out of the index, whatever its state. */
export function dropNote(id: string): void {
  const index: Record<string, NoteMeta> = {};
  for (const meta of listNotes()) {
    if (meta.id !== id) {
      index[meta.id] = meta;
    }
  }
  setJSON(NOTES_INDEX_KEY, index);
}

/** Every note still waiting to reach the server, oldest first. */
export function pendingNotes(): NoteMeta[] {
  return listNotes()
    .filter((note) => note.pendingSync === true)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
}

/**
 * Keep a freshly sung take, and return what the list will show for it.
 *
 * The audio stays where the capture left it. Copying it somewhere durable is
 * the upload's job; until then this uri is the only copy there is, which is
 * why the note records it rather than only the server path it does not have.
 */
export function keepLocally(
  input: CreateNoteInput,
  audioUri: string,
  id: string
): NoteMeta {
  const note: NoteMeta = {
    id,
    title: input.title,
    createdAtMs: Date.now(),
    durationMs: input.durationMs,
    sampleRateHz: input.sampleRateHz,
    // Nothing on the server yet, and saying otherwise would have playback
    // asking for a file that does not exist.
    audioPath: null,
    localAudioUri: audioUri,
    pendingSync: true,
    melody: input.melody,
    hits: input.hits ?? [],
    analysisVersion: input.analysisVersion,
    key: input.key ?? undefined,
    tempoBpm: input.tempoBpm ?? undefined,
    inTuneRatio: input.inTuneRatio ?? undefined,
    meanCentsError: input.meanCentsError ?? undefined,
    noteCount: input.noteCount,
    rangeLowMidi: input.rangeLowMidi ?? undefined,
    rangeHighMidi: input.rangeHighMidi ?? undefined,
    layers: [],
    interpretations: []
  };
  putNote(note);
  return note;
}
