/**
 * notesRepo — cloud CRUD for sung "notes" (the corpus).
 *
 * The single source of truth for saved notes is Supabase: a row in
 * `public.notes` plus the captured audio blob in the private `notes` Storage
 * bucket (`${user_id}/${note_id}.{ext}`). This module is the only seam that
 * talks to Supabase for notes; it maps the snake_case Postgres rows
 * (`Database['public']['Tables']['notes']`) to/from the camelCase
 * {@link NoteDto} contract from `shared`.
 *
 * The defining feature of a note is its `melody_json` — the symbolic
 * `NoteEvent[]` is persisted on insert and is the source of truth for all corpus
 * analysis, so re-aggregating the user's tendencies never re-touches audio.
 *
 * The bucket is private, so reads return short-lived signed URLs for playback.
 */
import { AppErrorCode, appError } from 'shared';
import type { CreateNoteInput, NoteDto, NoteEventDto } from 'shared';

import { backend, COLLECTIONS } from '../lib/backend';
import type { NoteRecord } from '../lib/backend';
import { requireUserId } from './currentUser';

type NoteRow = NoteRecord;

/** Blobs the client supplies when creating a note. */
export interface NoteBlobs {
  /** `file://` URI of the captured audio on disk. */
  audioUri: string;
}

/** The collection an audio file hangs off, for building its URL. */
const NOTES_COLLECTION = COLLECTIONS.notes;

// ---------------------------------------------------------------------------
// Row <-> DTO mapping (the only place snake_case meets camelCase)
// ---------------------------------------------------------------------------

/** Coerce the JSONB `melody_json` column into a typed {@link NoteEventDto}[]. */
function toMelody(json: unknown): NoteEventDto[] {
  return Array.isArray(json) ? (json as NoteEventDto[]) : [];
}

/** Map a Postgres row to the camelCase {@link NoteDto} wire shape. */
function rowToDto(row: NoteRow): NoteDto {
  return {
    id: row.id,
    userId: row.user,
    title: row.title,
    createdAtMs: Date.parse(row.created),
    durationMs: row.duration_ms,
    sampleRateHz: row.sample_rate_hz,
    // '' means nothing was attached; the DTO models absence as null.
    audioPath: row.audio.length > 0 ? row.audio : null,
    melody: toMelody(row.melody_json),
    key: row.key,
    tempoBpm: row.tempo_bpm,
    inTuneRatio: row.in_tune_ratio,
    meanCentsError: row.mean_cents_error,
    noteCount: row.note_count,
    rangeLowMidi: row.range_low_midi,
    rangeHighMidi: row.range_high_midi
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase file extension of a path/URI, without the dot; '' if none. */
function extOf(uri: string): string {
  const q = uri.split('?')[0];
  const dot = q.lastIndexOf('.');
  const slash = q.lastIndexOf('/');
  if (dot <= slash) {
    return '';
  }
  return q.slice(dot + 1).toLowerCase();
}

/**
 * A short-lived private URL for a note's audio, or null when it has none.
 *
 * Files on a collection whose view rule is owner-only are private: the URL
 * carries a token minted for the current session, so it is useless to anyone
 * else and expires on its own.
 */
async function fileUrl(
  noteId: string,
  filename: string | null
): Promise<string | null> {
  if (!filename) {
    return null;
  }
  try {
    const token = await backend.files.getToken();
    return backend.files.getURL(
      { id: noteId, collectionName: NOTES_COLLECTION },
      filename,
      { token }
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const notesRepo = {
  /**
   * Persist a finished note: the symbolic melody and the captured audio go up
   * in one multipart request. The previous backend needed two round trips —
   * insert the row, upload the blob, then patch the row with its path — and
   * read the whole audio file into a base64 string in JS memory to do it.
   * FormData streams the file straight off disk by URI instead.
   */
  async create(input: CreateNoteInput, blobs: NoteBlobs): Promise<NoteDto> {
    const userId = await requireUserId();

    const form = new FormData();
    form.append('user', userId);
    form.append('title', input.title);
    form.append('duration_ms', String(input.durationMs));
    form.append('sample_rate_hz', String(input.sampleRateHz));
    form.append('melody_json', JSON.stringify(input.melody));
    form.append('note_count', String(input.noteCount));
    if (input.key != null) form.append('key', input.key);
    if (input.tempoBpm != null) form.append('tempo_bpm', String(input.tempoBpm));
    if (input.inTuneRatio != null)
      form.append('in_tune_ratio', String(input.inTuneRatio));
    if (input.meanCentsError != null)
      form.append('mean_cents_error', String(input.meanCentsError));
    if (input.rangeLowMidi != null)
      form.append('range_low_midi', String(input.rangeLowMidi));
    if (input.rangeHighMidi != null)
      form.append('range_high_midi', String(input.rangeHighMidi));

    const audioExt = extOf(blobs.audioUri) || 'wav';
    // React Native's FormData accepts a {uri,name,type} descriptor and streams
    // the file off disk; the DOM lib types only know about Blob.
    form.append(
      'audio',
      { uri: blobs.audioUri, name: `audio.${audioExt}`, type: `audio/${audioExt}` }
    );

    try {
      const record = await backend
        .collection(COLLECTIONS.notes)
        .create<NoteRow>(form);
      return rowToDto(record);
    } catch (error) {
      throw appError(AppErrorCode.Storage, 'Failed to save note', error);
    }
  },

  /** All notes for the current user, newest first. */
  async list(): Promise<NoteDto[]> {
    await requireUserId();
    try {
      // The access rule already scopes this to the caller.
      const records = await backend
        .collection(COLLECTIONS.notes)
        .getFullList<NoteRow>({ sort: '-created' });
      return records.map(rowToDto);
    } catch (error) {
      throw appError(AppErrorCode.Network, 'Failed to list notes', error);
    }
  },

  /** A single note by id, or null when not found / not owned. */
  async get(id: string): Promise<NoteDto | null> {
    try {
      const record = await backend
        .collection(COLLECTIONS.notes)
        .getOne<NoteRow>(id);
      return rowToDto(record);
    } catch {
      // A record owned by someone else is indistinguishable from a missing
      // one, which is the point: the backend does not confirm its existence.
      return null;
    }
  },

  /** A fresh private URL for a note's audio. */
  async signedAudioUrl(note: NoteDto): Promise<string | null> {
    return fileUrl(note.id, note.audioPath);
  },

  /**
   * Delete a note. Deleting the record takes its attached audio with it, and
   * the access rule scopes the delete to the owner, so there is no separate
   * blob sweep and no way to delete someone else's.
   */
  async remove(id: string): Promise<void> {
    try {
      await backend.collection(COLLECTIONS.notes).delete(id);
    } catch (error) {
      throw appError(AppErrorCode.Network, 'Failed to delete note', error);
    }
  }
};

export type NotesRepo = typeof notesRepo;

export default notesRepo;
