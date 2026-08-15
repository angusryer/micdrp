/**
 * The Supabase client, and the generated row types for the schema.
 *
 * This is the only module that constructs a Supabase connection. Every repo in
 * `src/data` imports `supabase` from here and maps snake_case rows to the
 * camelCase DTO contracts in `shared`, so the database shape is confined to
 * this file and its immediate consumers.
 *
 * RECONSTRUCTED. The original was written but never committed: a bare `lib/`
 * line in .gitignore matches at any depth and silently excluded this whole
 * directory from every commit, so it exists in no branch, no remote and no
 * backup. The `Database` types below are written by hand from
 * supabase/migrations, and the client construction from its call sites and the
 * jest mocks that pin its contract. If the original ever resurfaces, diff it
 * against this rather than assuming either is right.
 *
 * Credentials come from `react-native-config`, which reads the git-secret
 * encrypted .env files at build time. Construction fails loudly when they are
 * absent: a client pointed at undefined would fail later with a confusing
 * network error instead of an obvious configuration one.
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

import { secureSessionStorage } from './secureSession';

// ---------------------------------------------------------------------------
// Schema types — hand-generated from supabase/migrations/0001_init.sql
// ---------------------------------------------------------------------------

/** A JSONB column's value. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          title: string;
          duration_ms: number;
          sample_rate_hz: number;
          audio_path: string | null;
          melody_json: Json;
          key: string | null;
          tempo_bpm: number | null;
          in_tune_ratio: number | null;
          mean_cents_error: number | null;
          note_count: number;
          range_low_midi: number | null;
          range_high_midi: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          title: string;
          duration_ms: number;
          sample_rate_hz: number;
          audio_path?: string | null;
          melody_json: Json;
          key?: string | null;
          tempo_bpm?: number | null;
          in_tune_ratio?: number | null;
          mean_cents_error?: number | null;
          note_count?: number;
          range_low_midi?: number | null;
          range_high_midi?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          title?: string;
          duration_ms?: number;
          sample_rate_hz?: number;
          audio_path?: string | null;
          melody_json?: Json;
          key?: string | null;
          tempo_bpm?: number | null;
          in_tune_ratio?: number | null;
          mean_cents_error?: number | null;
          note_count?: number;
          range_low_midi?: number | null;
          range_high_midi?: number | null;
        };
      };
      practice_progress: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          melody_id: string;
          root_midi: number;
          note_duration_ms: number;
          score: number | null;
          in_tune_ratio: number | null;
          mean_cents_error: number | null;
          evaluated_frames: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          melody_id: string;
          root_midi: number;
          note_duration_ms: number;
          score?: number | null;
          in_tune_ratio?: number | null;
          mean_cents_error?: number | null;
          evaluated_frames?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          melody_id?: string;
          root_midi?: number;
          note_duration_ms?: number;
          score?: number | null;
          in_tune_ratio?: number | null;
          mean_cents_error?: number | null;
          evaluated_frames?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** Deletes the caller's account and everything owned by it. */
      delete_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const url = Config.SUPABASE_URL;
const anonKey = Config.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase is not configured: SUPABASE_URL and SUPABASE_ANON_KEY must be ' +
      'present in the build environment. Run `git secret reveal` to decrypt ' +
      'the .env files, then rebuild.'
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url,
  anonKey,
  {
    auth: {
      // The session lives in the Keychain rather than plain AsyncStorage.
      storage: secureSessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL bar on a phone; deep-linked auth callbacks are handled
      // explicitly rather than sniffed out of the current location.
      detectSessionInUrl: false
    }
  }
);

export default supabase;
