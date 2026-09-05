/**
 * Noticing that a run has ended (INV-TPORT-011, INV-TPORT-014).
 *
 * The engine's word where it has one, and the decoded length where it
 * has not. A transport that only predicts is wrong whenever the
 * prediction is, and cannot be right about a run that failed early —
 * but a bundle newer than its binary has nothing else to go on, and
 * that is the normal case here rather than the odd one.
 *
 * Its own module so the store above stays the state machine and the
 * commands, and stays inside the file budget.
 */

/** How often the engine is asked whether the run is over. */
const WATCH_MS = 100;

export interface RunEndEngine {
  /**
   * Whether the engine says this run has finished, or undefined where
   * it cannot say — a binary older than this bundle.
   */
  hasEnded?(): boolean | undefined;
}

export interface RunWatch {
  /**
   * Say when the run that began at `fromMs` is over. `lengthMs` is the
   * decoded length, used only where the engine cannot be asked.
   */
  watch(lengthMs: number, fromMs: number, ended: () => void): void;
  /** Stop watching. A no-op where nothing is being watched. */
  cancel(): void;
}

export function createRunWatch(engine: RunEndEngine): RunWatch {
  /** The fallback end, armed only where the engine cannot say. */
  let endsAt: ReturnType<typeof setTimeout> | null = null;
  /** Asking the engine whether the run is over, while one is. */
  let watching: ReturnType<typeof setInterval> | null = null;

  const cancel = (): void => {
    if (endsAt != null) {
      clearTimeout(endsAt);
      endsAt = null;
    }
    if (watching != null) {
      clearInterval(watching);
      watching = null;
    }
  };

  return {
    cancel,
    watch(lengthMs: number, fromMs: number, ended: () => void): void {
      cancel();
      const finish = (): void => {
        cancel();
        ended();
      };
      // Asked rather than predicted, wherever there is something to ask.
      if (
        typeof engine.hasEnded === 'function' &&
        engine.hasEnded() !== undefined
      ) {
        watching = setInterval(() => {
          if (engine.hasEnded?.() === true) {
            finish();
          }
        }, WATCH_MS);
        return;
      }
      endsAt = setTimeout(finish, Math.max(0, lengthMs - fromMs));
    }
  };
}
