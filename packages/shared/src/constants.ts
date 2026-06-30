/** Shared constants used across client and backend definitions. */

/** Supabase Storage bucket for audio + MIDI blobs. */
export const STORAGE_BUCKET = 'takes';

/** Supabase table names — single source of truth for both sides. */
export const TABLES = {
  profiles: 'profiles',
  recordings: 'recordings'
} as const;

// The "in tune" cents tolerance lives in `logic` (DEFAULT_TOLERANCE_CENTS) — it
// is a scoring-algorithm parameter, owned by the package that defines scoring,
// not a cross-cutting wire constant.
