/**
 * recordingMachine — the coarse lifecycle of a single recording session.
 *
 * This machine is intentionally PURE: it owns no audio, navigation or UI
 * concerns. The real side effects (request OS permission, start/stop the
 * `AudioEngine`, run the offline analysis pipeline) are injected by the Record
 * screen via `machine.withConfig(...)` — see `recordingMachineConfig` for the
 * service/action keys a consumer must supply.
 *
 * States:
 *   idle ─REQUEST_PERMISSION─► requestingPermission
 *   requestingPermission ─PERMISSION_GRANTED─► recording
 *   requestingPermission ─PERMISSION_DENIED─► error
 *   recording ─STOP─► analyzing
 *   analyzing ─ANALYZED(handle)─► result
 *   result ─RESET─► idle
 *   (any) ─ERROR(message)─► error
 *   error ─RESET─► idle
 *
 * The machine only stores coarse data: the finished `RecordingHandle` and the
 * last error message. The per-audio-frame `PitchSample` stream NEVER flows
 * through here — it stays on the UI thread (Reanimated shared values).
 *
 * XState v4 syntax (imports `createMachine`/`assign` straight from `xstate`).
 */

import { createMachine, assign } from 'xstate';
import type { RecordingHandle } from '../audio/contract';

/** Coarse data the machine tracks across transitions. */
export interface RecordingContext {
  /** The finished capture once analysis resolves; null until then. */
  handle: RecordingHandle | null;
  /** Human-readable reason for the last failure; null when healthy. */
  errorMessage: string | null;
}

/** Events the Record screen sends into the machine. */
export type RecordingEvent =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'ANALYZED'; data: RecordingHandle }
  | { type: 'RESET' }
  | { type: 'ERROR'; message?: string };

/** The discrete states (typestate value strings). */
export type RecordingStateValue =
  | 'idle'
  | 'requestingPermission'
  | 'recording'
  | 'analyzing'
  | 'result'
  | 'error';

/** Stable id so consumers can target it and tests can assert it. */
export const RECORDING_MACHINE_ID = 'recording';

/** The pristine context every fresh session starts from. */
export const INITIAL_RECORDING_CONTEXT: RecordingContext = {
  handle: null,
  errorMessage: null
};

const setHandle = assign<RecordingContext, RecordingEvent>({
  handle: (_ctx, event) => (event.type === 'ANALYZED' ? event.data : null),
  errorMessage: () => null
});

const setError = assign<RecordingContext, RecordingEvent>({
  errorMessage: (_ctx, event) =>
    event.type === 'ERROR' && event.message
      ? event.message
      : 'Recording failed'
});

const clearContext = assign<RecordingContext, RecordingEvent>({
  handle: () => null,
  errorMessage: () => null
});

/**
 * The machine. Side-effecting actions/services are referenced by string name
 * here and supplied by the screen via `.withConfig`. Keep this file free of any
 * audio/navigation imports so it can be unit-tested with no device.
 *
 * Recognised injection points (all optional — the machine transitions purely
 * even if none are provided):
 *   actions:  `engineStart`, `engineStop`, `onResult`, `onError`
 *   services: (none required; the screen drives async work and feeds results
 *              back in as `PERMISSION_GRANTED` / `ANALYZED` / `ERROR` events)
 */
export const recordingMachine = createMachine<
  RecordingContext,
  RecordingEvent
>(
  {
    id: RECORDING_MACHINE_ID,
    predictableActionArguments: true,
    initial: 'idle',
    context: INITIAL_RECORDING_CONTEXT,
    on: {
      // A failure can interrupt any state.
      ERROR: { target: 'error', actions: ['setError', 'onError'] }
    },
    states: {
      idle: {
        entry: ['clearContext'],
        on: {
          REQUEST_PERMISSION: 'requestingPermission',
          // Allow skipping the permission gate if the caller already holds it.
          START: 'recording'
        }
      },
      requestingPermission: {
        on: {
          PERMISSION_GRANTED: 'recording',
          PERMISSION_DENIED: {
            target: 'error',
            actions: ['setError']
          }
        }
      },
      recording: {
        entry: ['engineStart'],
        on: {
          STOP: 'analyzing'
        }
      },
      analyzing: {
        entry: ['engineStop'],
        on: {
          ANALYZED: {
            target: 'result',
            actions: ['setHandle']
          }
        }
      },
      result: {
        entry: ['onResult'],
        on: {
          RESET: 'idle'
        }
      },
      error: {
        on: {
          RESET: 'idle',
          // Allow an immediate retry of the permission flow from an error.
          REQUEST_PERMISSION: 'requestingPermission'
        }
      }
    }
  },
  {
    actions: {
      setHandle,
      setError,
      clearContext,
      // No-op defaults for the side-effecting hooks the screen overrides.
      engineStart: () => undefined,
      engineStop: () => undefined,
      onResult: () => undefined,
      onError: () => undefined
    }
  }
);

export type RecordingMachine = typeof recordingMachine;
