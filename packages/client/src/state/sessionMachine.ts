/**
 * sessionMachine — the app/session lifecycle.
 *
 * Models the coarse boot of the app shell: while `booting`, providers mount the
 * persistence store and probe the audio engine; once warm, the app is `ready`.
 * A `RELOAD` event drops back to `booting` (e.g. after a settings change that
 * needs the engine re-configured, or a hot store reset).
 *
 * Pure machine — no UI/audio imports. The screen/provider supplies the actual
 * bootstrap work via `.withConfig` (the `bootstrap` service) and signals
 * `BOOTED` / `BOOT_FAILED`, or simply sends `READY`.
 *
 * States:
 *   booting ─READY─► ready
 *   booting ─BOOT_FAILED─► failed
 *   ready ─RELOAD─► booting
 *   failed ─RELOAD─► booting
 *
 * XState v4 syntax (imports `createMachine`/`assign` straight from `xstate`).
 */

import { createMachine, assign } from 'xstate';

/** Coarse session context. */
export interface SessionContext {
  /** Reason the last bootstrap failed; null when healthy. */
  errorMessage: string | null;
}

/** Events that drive the session lifecycle. */
export type SessionEvent =
  | { type: 'READY' }
  | { type: 'BOOT_FAILED'; message?: string }
  | { type: 'RELOAD' };

/** The discrete states. */
export type SessionStateValue = 'booting' | 'ready' | 'failed';

/** Stable id for targeting/asserting. */
export const SESSION_MACHINE_ID = 'session';

/** Pristine session context. */
export const INITIAL_SESSION_CONTEXT: SessionContext = {
  errorMessage: null
};

const setBootError = assign<SessionContext, SessionEvent>({
  errorMessage: (_ctx, event) =>
    event.type === 'BOOT_FAILED' && event.message
      ? event.message
      : 'Failed to start the app'
});

const clearBootError = assign<SessionContext, SessionEvent>({
  errorMessage: () => null
});

/**
 * The machine. The provider injects the real bootstrap via `.withConfig` and
 * feeds the result back as `READY` / `BOOT_FAILED`.
 *
 * Recognised injection points:
 *   actions: `onBoot` (fired on entry to `booting`), `onReady`, `onFailed`
 */
export const sessionMachine = createMachine<SessionContext, SessionEvent>(
  {
    id: SESSION_MACHINE_ID,
    predictableActionArguments: true,
    initial: 'booting',
    context: INITIAL_SESSION_CONTEXT,
    states: {
      booting: {
        entry: ['clearBootError', 'onBoot'],
        on: {
          READY: 'ready',
          BOOT_FAILED: { target: 'failed', actions: ['setBootError'] }
        }
      },
      ready: {
        entry: ['onReady'],
        on: {
          RELOAD: 'booting'
        }
      },
      failed: {
        entry: ['onFailed'],
        on: {
          RELOAD: 'booting'
        }
      }
    }
  },
  {
    actions: {
      setBootError,
      clearBootError,
      onBoot: () => undefined,
      onReady: () => undefined,
      onFailed: () => undefined
    }
  }
);

export type SessionMachine = typeof sessionMachine;
