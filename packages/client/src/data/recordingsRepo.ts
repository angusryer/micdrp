/**
 * recordingsRepo — cloud CRUD for takes (WP-CLIENT-DATA).
 *
 * The single source of truth for saved recordings is Supabase: a row in
 * `public.recordings` plus the audio + MIDI blobs in the private `takes` Storage
 * bucket (`${user_id}/${recording_id}.{ext}`). This module is the only seam that
 * talks to Supabase for recordings; it maps the snake_case Postgres rows
 * (`Database['public']['Tables']['recordings']`) to/from the camelCase
 * {@link RecordingDto} contract from `shared` — DTO field names are the wire
 * shape, row column names are the DB shape, and neither is duplicated.
 *
 * The bucket is private, so reads return short-lived signed URLs for playback.
 * Domain analysis types stay in `logic`; this layer only ever produces DTOs.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §1 (data model) and §3 (WP-CLIENT-DATA).
 */
import { STORAGE_BUCKET, TABLES, AppErrorCode, appError } from 'shared';
import type { CreateRecordingInput, RecordingDto } from 'shared';

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { requireUserId } from './currentUser';

type RecordingRow = Database['public']['Tables']['recordings']['Row'];

/** Blobs the client supplies when creating a recording. */
export interface RecordingBlobs {
  /** `file://` URI of the captured audio on disk. */
  audioUri: string;
  /** Standard MIDI File bytes for the exported take. */
  midiBytes: Uint8Array;
}

/** A recording paired with freshly-signed Storage URLs for playback/export. */
export interface SignedRecording {
  recording: RecordingDto;
  /** Signed URL for the audio blob, or null when no audio is stored. */
  audioUrl: string | null;
  /** Signed URL for the MIDI blob, or null when no MIDI is stored. */
  midiUrl: string | null;
}

/** Seconds a signed Storage URL stays valid (one hour). */
const SIGNED_URL_TTL_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Row <-> DTO mapping (the only place snake_case meets camelCase)
// ---------------------------------------------------------------------------

/** Map a Postgres row to the camelCase {@link RecordingDto} wire shape. */
function rowToDto(row: RecordingRow): RecordingDto {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAtMs: Date.parse(row.created_at),
    durationMs: row.duration_ms,
    sampleRateHz: row.sample_rate_hz,
    noteCount: row.note_count,
    score: row.score,
    key: row.key,
    tempoBpm: row.tempo_bpm,
    audioPath: row.audio_path,
    midiPath: row.midi_path
  };
}

// ---------------------------------------------------------------------------
// Base64 <-> bytes (audio is read off disk as base64; Storage wants bytes)
// ---------------------------------------------------------------------------

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Reverse lookup table for {@link base64ToBytes}, built once. */
const B64_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < B64_CHARS.length; i++) {
    map[B64_CHARS[i]] = i;
  }
  return map;
})();

/**
 * Decode a base64 string to raw bytes. Pure and dependency-free (no `Buffer`/
 * `atob`) so it runs on-device and in tests. Ignores whitespace and `=` padding.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const byteLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(byteLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean[i]] ?? 0;
    const c1 = B64_LOOKUP[clean[i + 1]] ?? 0;
    const c2 = i + 2 < len ? B64_LOOKUP[clean[i + 2]] ?? 0 : 0;
    const c3 = i + 3 < len ? B64_LOOKUP[clean[i + 3]] ?? 0 : 0;
    if (o < byteLen) out[o++] = (c0 << 2) | (c1 >> 4);
    if (o < byteLen) out[o++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (o < byteLen) out[o++] = ((c2 & 0x03) << 6) | c3;
  }
  return out;
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

export const recordingsRepo = {
  /**
   * Persist a finished take: insert the row, upload the audio + MIDI blobs to
   * the private bucket under `${userId}/${id}.{ext}`, then patch the row with the
   * resulting Storage paths. Returns the canonical {@link RecordingDto}.
   *
   * The id and `created_at` are generated by Postgres on insert, so Storage
   * paths are addressed by the authoritative row id (no client UUID needed).
   */
  async create(
    input: CreateRecordingInput,
    blobs: RecordingBlobs
  ): Promise<RecordingDto> {
    const userId = await requireUserId();

    const { data: inserted, error: insertError } = await supabase
      .from(TABLES.recordings)
      .insert({
        user_id: userId,
        title: input.title,
        duration_ms: input.durationMs,
        sample_rate_hz: input.sampleRateHz,
        note_count: input.noteCount,
        score: input.score ?? null,
        key: input.key ?? null,
        tempo_bpm: input.tempoBpm ?? null,
        audio_path: null,
        midi_path: null
      })
      .select()
      .single();

    if (insertError || !inserted) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to insert recording row',
        insertError ?? undefined
      );
    }

    const id = inserted.id;
    const audioExt = extOf(blobs.audioUri) || 'm4a';
    const audioPath = `${userId}/${id}.${audioExt}`;
    const midiPath = `${userId}/${id}.mid`;

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
    const midiUpload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(midiPath, blobs.midiBytes, {
        contentType: 'audio/midi',
        upsert: true
      });

    if (audioUpload.error || midiUpload.error) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to upload recording blobs',
        audioUpload.error ?? midiUpload.error ?? undefined
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from(TABLES.recordings)
      .update({ audio_path: audioPath, midi_path: midiPath })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      throw appError(
        AppErrorCode.Storage,
        'Failed to attach storage paths to recording',
        updateError ?? undefined
      );
    }

    return rowToDto(updated);
  },

  /** All recordings for the current user, newest first. */
  async list(): Promise<RecordingDto[]> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(TABLES.recordings)
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw appError(
        AppErrorCode.Network,
        'Failed to list recordings',
        error
      );
    }
    return (data ?? []).map(rowToDto);
  },

  /** A single recording by id, or null when not found / not owned. */
  async get(id: string): Promise<RecordingDto | null> {
    const { data, error } = await supabase
      .from(TABLES.recordings)
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to fetch recording', error);
    }
    return data ? rowToDto(data) : null;
  },

  /**
   * Fresh signed Storage URLs for a recording's audio + MIDI blobs (the bucket
   * is private, so direct paths are not publicly fetchable).
   */
  async signedUrls(
    recording: RecordingDto
  ): Promise<{ audioUrl: string | null; midiUrl: string | null }> {
    const [audioUrl, midiUrl] = await Promise.all([
      signPath(recording.audioPath),
      signPath(recording.midiPath)
    ]);
    return { audioUrl, midiUrl };
  },

  /**
   * Delete a recording: remove its Storage blobs (best-effort) then the row.
   * RLS scopes the row delete to the owner.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.get(id);
    if (existing) {
      const paths = [existing.audioPath, existing.midiPath].filter(
        (p): p is string => p != null
      );
      if (paths.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      }
    }
    const { error } = await supabase
      .from(TABLES.recordings)
      .delete()
      .eq('id', id);
    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to delete recording', error);
    }
  }
};

export type RecordingsRepo = typeof recordingsRepo;

export default recordingsRepo;
