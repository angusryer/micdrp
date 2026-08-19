/**
 * sessionMachine — the app/session lifecycle.
 *
 * Models the coarse boot of the app shell: while `booting`, providers mount the
 * persistence store and probe the audio engine; once warm, the app is `ready`.
 * A `RELOAD` event drops back to `booting` (e.g. after a settings change that
 * needs the engine re-configured, or a hot store reset).
 *
 * Pure machine — no UI/audio imports. The screen/provider supplies the actual
 * bootstrap work via `.provide` and signals `BOOT_FAILED`, or simply sends
 * `READY`.
 *
 * States:
 *   booting ─READY─► ready
 *   booting ─BOOT_FAILED─► failed
 *   ready ─RELOAD─► booting
 *   failed ─RELOAD─► booting
 *
 * XState v5: `setup()` carries the context/event types, so actions infer
 * without generics, and `.provide()` replaces v4's `.withConfig()`.
 */

import { assign, setup } from 'xstate';

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

/**
 * The machine. The provider injects the real bootstrap via `.provide` and
 * feeds the result back as `READY` / `BOOT_FAILED`.
 *
 * Recognised injection points:
 *   actions: `onBoot` (fired on entry to `booting`), `onReady`, `onFailed`
 */
export const sessionMachine = setup({
  types: {
    context: {} as SessionContext,
    events: {} as SessionEvent
  },
  actions: {
    setBootError: assign({
      errorMessage: ({ event }) =>
        event.type === 'BOOT_FAILED' && event.message
          ? event.message
          : 'Failed to start the app'
    }),
    clearBootError: assign({ errorMessage: () => null }),
    onBoot: () => undefined,
    onReady: () => undefined,
    onFailed: () => undefined
  }
}).createMachine({
  id: SESSION_MACHINE_ID,
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
      on: { RELOAD: 'booting' }
    },
    failed: {
      entry: ['onFailed'],
      on: { RELOAD: 'booting' }
    }
  }
});

export type SessionMachine = typeof sessionMachine;
