/**
 * Typed MMKV singleton wrapper for micdrp persistence.
 *
 * One process-wide instance, id `'micdrp'`. All structured records are stored as
 * JSON strings via {@link getJSON}/{@link setJSON}; primitive helpers cover the
 * rest. This is the only module that talks to `react-native-mmkv` directly so the
 * rest of the data layer (and tests) depend on a single, mockable seam.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-PERSIST).
 */
import { MMKV } from 'react-native-mmkv';

/** The single backing store id; keep stable — changing it orphans existing data. */
export const STORE_ID = 'micdrp';

/** Lazily-created singleton so importing this module never touches native early. */
let instance: MMKV | null = null;

function mmkv(): MMKV {
  if (instance === null) {
    instance = new MMKV({ id: STORE_ID });
  }
  return instance;
}

/** Read a raw string, or `undefined` if absent. */
export function getString(key: string): string | undefined {
  return mmkv().getString(key);
}

/** Write a raw string. */
export function setString(key: string, value: string): void {
  mmkv().set(key, value);
}

/**
 * Read and JSON-parse a value. Returns `undefined` when the key is missing or the
 * stored payload fails to parse (corruption is treated as absence, never thrown).
 */
export function getJSON<T>(key: string): T | undefined {
  const raw = mmkv().getString(key);
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** JSON-stringify and write a value. */
export function setJSON<T>(key: string, value: T): void {
  mmkv().set(key, JSON.stringify(value));
}

/** Delete a key. No-op if absent. */
export function remove(key: string): void {
  mmkv().delete(key);
}

/** Whether a key is present. */
export function has(key: string): boolean {
  return mmkv().contains(key);
}

/** All keys currently in the store. */
export function getAllKeys(): string[] {
  return mmkv().getAllKeys();
}

/** Wipe the entire store. Test/debug use; not exposed in app UI. */
export function clearAll(): void {
  mmkv().clearAll();
}

/**
 * The typed store surface, also exported as a namespace object for ergonomic
 * `store.getJSON(...)` call sites. Members mirror the named exports above.
 */
export const store = {
  getString,
  setString,
  getJSON,
  setJSON,
  delete: remove,
  remove,
  has,
  getAllKeys,
  clearAll
} as const;

export default store;
