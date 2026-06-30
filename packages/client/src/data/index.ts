/**
 * Persistence layer barrel (WP-PERSIST).
 *
 * - `store`    — typed MMKV singleton wrapper (id `micdrp`).
 * - `files`    — react-native-fs path helpers + MIDI blob writer.
 * - `recordings` — CRUD over the MMKV-backed recordings index.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-PERSIST).
 */
export * from './store';
export * from './files';
export * from './recordings';
