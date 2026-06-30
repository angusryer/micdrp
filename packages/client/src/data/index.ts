/**
 * Data layer barrel.
 *
 * - `store`                — typed MMKV singleton wrapper (id `micdrp`).
 * - `files`                — react-native-fs path helpers + MIDI blob writer.
 * - `recordingBytes`       — base64 <-> bytes for Storage uploads.
 * - `currentUser`          — the authenticated user's id (shared auth guard).
 * - `notesCache`           — read access over the MMKV notes cache (+ corpus melodies).
 * - `notesRepo`            — Supabase Postgres + Storage CRUD for notes (source of truth).
 * - `notesSync`            — server-authoritative reconcile of the notes cache.
 * - `practiceProgressRepo` — Supabase CRUD for practice trajectory rows.
 * - `practiceProgressSync` — server-authoritative cache of the practice trajectory.
 * - `profilesRepo`         — Supabase profile read/update + account deletion.
 */
export * from './store';
export * from './files';
export * from './recordingBytes';
export * from './currentUser';
export * from './notesCache';
export * from './notesRepo';
export * from './notesSync';
export * from './practiceProgressRepo';
export * from './practiceProgressSync';
export * from './profilesRepo';
