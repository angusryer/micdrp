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
import { STORAGE_BUCKET, TABLES, AppErrorCode, appError } from 'shared';
import type { CreateNoteInput, NoteDto, NoteEventDto } from 'shared';

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { requireUserId } from './currentUser';
import { base64ToBytes } from './recordingBytes';

type NoteRow = Database['public']['Tables']['notes']['Row'];

/** Blobs the client supplies when creating a note. */
export interface NoteBlobs {
  /** `file://` URI of the captured audio on disk. */
  audioUri: string;
}

/** Seconds a signed Storage URL stays valid (one hour). */
const SIGNED_URL_TTL_SECONDS = 3600;

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
    userId: row.user_id,
    title: row.title,
    createdAtMs: Date.parse(row.created_at),
    durationMs: row.duration_ms,
    sampleRateHz: row.sample_rate_hz,
    audioPath: row.audio_path,
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

/** A short-lived signed URL for a Storage object, or null on absent/failed path. */
async function signPath(path: string | null): Promise<string | null> {
  if (!path) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return null;
  }
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const notesRepo = {
  /**
   * Persist a finished note: insert the row (with the symbolic melody), upload
   * the captured audio to the private bucket under `${userId}/${id}.{ext}`, then
   * patch the row with the resulting Storage path. Returns the canonical
   * {@link NoteDto}.
   */
  async create(input: CreateNoteInput, blobs: NoteBlobs): Promise<NoteDto> {
    const userId = await requireUserId();

    const { data: inserted, error: insertError } = await supabase
      .from(TABLES.notes)
      .insert({
        user_id: userId,
        title: input.title,
        duration_ms: input.durationMs,
        sample_rate_hz: input.sampleRateHz,
        audio_path: null,
        melody_json: input.melody,
        key: input.key ?? null,
        tempo_bpm: input.tempoBpm ?? null,
        in_tune_ratio: input.inTuneRatio ?? null,
        mean_cents_error: input.meanCentsError ?? null,
        note_count: input.noteCount,
        range_low_midi: input.rangeLowMidi ?? null,
        range_high_midi: input.rangeHighMidi ?? null
      })
      .select()
      .single();

    if (insertError || !inserted) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to insert note row',
        insertError ?? undefined
      );
    }

    const id = inserted.id;
    const audioExt = extOf(blobs.audioUri) || 'wav';
    const audioPath = `${userId}/${id}.${audioExt}`;

    // Read the captured audio off disk as base64, decode to bytes, upload.
    // react-native-fs is the single fs seam; import lazily so non-RN tests that
    // never call create() don't need it resolved.
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- deliberate lazy load (see above)
    const RNFS = require('react-native-fs') as typeof import('react-native-fs');
    const localAudioPath = blobs.audioUri.replace(/^file:\/\//, '');
    const audioB64 = await RNFS.readFile(localAudioPath, 'base64');
    const audioBytes = base64ToBytes(audioB64);

    const audioUpload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(audioPath, audioBytes, {
        contentType: audioExt === 'wav' ? 'audio/wav' : 'audio/mp4',
        upsert: true
      });

    if (audioUpload.error) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to upload note audio',
        audioUpload.error
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from(TABLES.notes)
      .update({ audio_path: audioPath })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to attach storage path to note',
        updateError ?? undefined
      );
    }

    return rowToDto(updated);
  },

  /** All notes for the current user, newest first. */
  async list(): Promise<NoteDto[]> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(TABLES.notes)
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to list notes', error);
    }
    return (data ?? []).map(rowToDto);
  },

  /** A single note by id, or null when not found / not owned. */
  async get(id: string): Promise<NoteDto | null> {
    const { data, error } = await supabase
      .from(TABLES.notes)
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to fetch note', error);
    }
    return data ? rowToDto(data) : null;
  },

  /** A fresh signed Storage URL for a note's audio blob (the bucket is private). */
  async signedAudioUrl(note: NoteDto): Promise<string | null> {
    return signPath(note.audioPath);
  },

  /**
   * Delete a note: remove its Storage blob (best-effort) then the row. RLS scopes
   * the row delete to the owner.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.get(id);
    if (existing?.audioPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([existing.audioPath]);
    }
    const { error } = await supabase.from(TABLES.notes).delete().eq('id', id);
    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to delete note', error);
    }
  }
};

export type NotesRepo = typeof notesRepo;

export default notesRepo;
