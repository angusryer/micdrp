/**
 * Taking an update, or putting it off.
 *
 * Deferral is session-scoped by design (INV-UPD-007). "Later" has to mean
 * something, or the prompt becomes a nag that trains the singer to dismiss it
 * without reading — but it must not mean "never", or a fix stops propagating
 * because someone tapped later once. Holding the deferral in module state
 * gives exactly that: it survives every foreground for the rest of the
 * session, and dies with the process, at which point the staged bundle is
 * simply what the app loads.
 */
import { HotUpdater } from '@hot-updater/react-native';

const deferred = new Set<string>();

/** Has the singer already said "later" to this bundle in this session? */
export function isDeferred(bundleId: string): boolean {
  return deferred.has(bundleId);
}

/**
 * Record a "later".
 *
 * Nothing is discarded: the bundle stays staged, so the next cold start runs
 * it without asking again. The deferral only suppresses the prompt.
 */
export function deferUpdate(bundleId: string): void {
  deferred.add(bundleId);
}

/**
 * Reload against the staged bundle.
 *
 * This changes which JavaScript runs and nothing else — the binary, every
 * native module, the C++ pitch engine and every value react-native-config
 * baked in are all untouched (INV-UPD-005).
 */
export async function applyUpdate(): Promise<void> {
  await HotUpdater.reload();
}

/** Test seam. Never called by app code. */
export function resetDeferralsForTests(): void {
  deferred.clear();
}
