/** Shared constants used across client and backend definitions. */

/** Supabase Storage bucket for audio + MIDI blobs. */
export const STORAGE_BUCKET = 'takes';

/** Supabase table names — single source of truth for both sides. */
export const TABLES = {
  profiles: 'profiles',
  recordings: 'recordings'
} as const;

/** Default cents tolerance for "in tune" (mirrors logic scoring default). */
export const IN_TUNE_TOLERANCE_CENTS = 50;
