/**
 * Whether something is happening that a restart prompt must not interrupt
 * (INV-UPD-004).
 *
 * A modal thrown over a live take costs the take, and a take is the one thing
 * in this app the singer cannot redo identically. So the gate asks here before
 * it presents, and the screens that own a capture or a guided session declare
 * themselves busy for as long as they are.
 *
 * This is a module-level registry rather than React state on purpose: the
 * check happens in an app-lifecycle handler that is not inside the tree that
 * owns the recording, and threading a context through the navigator for one
 * boolean would couple the two domains far harder than a counter does.
 */
import type { BusyActivity } from './types';

const active = new Set<BusyActivity>();
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/** Declare an activity started. Returns the function that ends it. */
export function markBusy(activity: BusyActivity): () => void {
  active.add(activity);
  notify();

  let released = false;
  return () => {
    // Idempotent: a screen that unmounts after already clearing its own
    // activity must not end a second one started since.
    if (released) {
      return;
    }
    released = true;
    active.delete(activity);
    notify();
  };
}

/** True while anything is running that the prompt must wait for. */
export function isBusy(): boolean {
  return active.size > 0;
}

/**
 * Subscribe to busy/idle transitions, so a prompt held back during a take can
 * be presented the moment the take ends rather than waiting for the next
 * foreground event — which might be days away, or never.
 */
export function subscribeToBusy(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. Never called by app code. */
export function resetBusyForTests(): void {
  active.clear();
  listeners.clear();
}
