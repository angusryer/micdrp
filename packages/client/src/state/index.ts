/**
 * Barrel for the XState machines that drive coarse app/recording lifecycle.
 *
 * Machines are pure: they orchestrate the `AudioEngine` contract via
 * services/actions injected by the screens (`.withConfig`), never importing
 * audio or UI code themselves.
 */

export {
  recordingMachine,
  RECORDING_MACHINE_ID,
  INITIAL_RECORDING_CONTEXT
} from './recordingMachine';
export type {
  RecordingContext,
  RecordingEvent,
  RecordingStateValue,
  RecordingMachine
} from './recordingMachine';

export {
  sessionMachine,
  SESSION_MACHINE_ID,
  INITIAL_SESSION_CONTEXT
} from './sessionMachine';
export type {
  SessionContext,
  SessionEvent,
  SessionStateValue,
  SessionMachine
} from './sessionMachine';
