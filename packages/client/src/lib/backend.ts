/**
 * The backend client, and the record types for the collections.
 *
 * This is the only module that constructs a connection. Every repo in
 * `src/data` imports `backend` from here and maps snake_case record fields to
 * the camelCase DTO contracts in `shared`, so the storage shape is confined to
 * this file and its immediate consumers.
 *
 * The instance is self-hosted PocketBase (see backend/README.md). It needs no
 * publishable key: access is decided by the per-record rules declared in
 * backend/migrations, evaluated server-side on every request.
 *
 * The URL comes from `react-native-config`, which reads the git-secret
 * encrypted .env files at build time. Construction fails loudly when it is
 * absent: a client pointed at undefined would fail later with a confusing
 * network error instead of an obvious configuration one.
 */
import 'react-native-url-polyfill/auto';
import PocketBase, { AsyncAuthStore } from 'pocketbase';
import Config from 'react-native-config';

import { secureSessionStorage } from './secureSession';

// ---------------------------------------------------------------------------
// Record types — mirror backend/migrations
// ---------------------------------------------------------------------------

/** Collection names. Keep in step with backend/migrations. */
export const COLLECTIONS = {
  users: 'users',
  notes: 'notes',
  practiceProgress: 'practice_progress'
} as const;

/** Fields every record carries. */
interface BaseRecord {
  id: string;
  created: string;
  updated?: string;
}

/** The auth record. Its `name` is the singer's display name — there is no
 *  separate profiles collection, so one account has exactly one profile. */
export interface UserRecord extends BaseRecord {
  email: string;
  name: string;
  verified: boolean;
}

export interface NoteRecord extends BaseRecord {
  user: string;
  title: string;
  duration_ms: number;
  sample_rate_hz: number;
  /** Attached audio filename, or '' when nothing was uploaded. */
  audio: string;
  melody_json: unknown;
  key: string;
  tempo_bpm: number | null;
  in_tune_ratio: number | null;
  mean_cents_error: number | null;
  note_count: number;
  range_low_midi: number | null;
  range_high_midi: number | null;
}

export interface PracticeProgressRecord extends BaseRecord {
  user: string;
  melody_id: string;
  root_midi: number;
  note_duration_ms: number;
  score: number | null;
  in_tune_ratio: number | null;
  mean_cents_error: number | null;
  evaluated_frames: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const AUTH_KEY = 'pb_auth';

const url = Config.BACKEND_URL;

if (!url) {
  throw new Error(
    'The backend is not configured: BACKEND_URL must be present in the build ' +
      'environment. Run `git secret reveal` to decrypt the .env files, then ' +
      'rebuild.'
  );
}

/**
 * The session lives in the Keychain rather than plain storage, so a refresh
 * token does not survive a backup or a compromised device in readable form.
 */
const authStore = new AsyncAuthStore({
  save: (serialized) => secureSessionStorage.setItem(AUTH_KEY, serialized),
  initial: secureSessionStorage.getItem(AUTH_KEY),
  clear: () => secureSessionStorage.removeItem(AUTH_KEY)
});

export const backend = new PocketBase(url, authStore);

// A phone has no URL bar; nothing should be inferred from a current location.
backend.autoCancellation(false);

export default backend;
