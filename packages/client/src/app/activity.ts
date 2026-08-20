/**
 * Whether something is happening that must not be interrupted.
 *
 * Two domains ask: `updates` before showing a restart prompt (INV-UPD-004),
 * and `dogfood` before recording a spoken remark (INV-DOG-001). For updates
 * the cost of interrupting is a lost take; for dogfood it is that, plus the
 * microphone being exclusive — AVAudioSession serves one purpose at a time.
 *
 * It lives here rather than in either domain because it belongs to neither:
 * it is the app's answer to "is the singer in the middle of something".
 *
 * A module-level registry rather than React state on purpose. Both consumers
 * sit outside the tree that owns the recording, and threading a context
 * through the navigator for one boolean would couple them far harder than a
 * counter does.
 */

/** An activity that owns the microphone, or the singer's attention. */
export type BusyActivity = 'capture' | 'practice session';

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
