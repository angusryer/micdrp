/**
 * Data layer barrel.
 *
 * - `store`          — typed MMKV singleton wrapper (id `micdrp`).
 * - `files`          — react-native-fs path helpers + MIDI blob writer.
 * - `currentUser`    — the authenticated user's id (shared auth guard).
 * - `recordings`     — CRUD over the MMKV-backed recordings cache.
 * - `recordingsRepo` — Supabase Postgres + Storage CRUD (cloud source of truth).
 * - `profilesRepo`   — Supabase profile read/update + account deletion.
 * - `sync`           — server-authoritative reconcile of the cache with the cloud.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-DATA).
 */
export * from './store';
export * from './files';
export * from './currentUser';
export * from './recordings';
export * from './recordingsRepo';
export * from './profilesRepo';
export * from './sync';
