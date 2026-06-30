/**
 * Data layer barrel.
 *
 * - `store`          — typed MMKV singleton wrapper (id `micdrp`).
 * - `files`          — react-native-fs path helpers + MIDI blob writer.
 * - `recordings`     — CRUD over the MMKV-backed recordings cache.
 * - `recordingsRepo` — Supabase Postgres + Storage CRUD (cloud source of truth).
 * - `sync`           — server-authoritative reconcile of the cache with the cloud.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-DATA).
 */
export * from './store';
export * from './files';
export * from './recordings';
export * from './recordingsRepo';
export * from './sync';
