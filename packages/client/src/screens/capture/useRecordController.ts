/**
 * useRecordController — the binding layer between the live `AudioEngine`, the
 * pure `recordingMachine`, and the Reanimated shared values that drive the Skia
 * pitch UI on the UI thread.
 *
 * THE HOT-PATH RULE (docs/NATIVE_BUILD_PLAN.md §0): every `PitchSample` the
 * engine emits is written straight into a Reanimated shared value. It NEVER
 * touches React state — React only re-renders on the coarse machine transitions
 * (idle → recording → analyzing → result). The per-frame path therefore never
 * blocks or schedules a JS render.
 *
 * Responsibilities:
 *   • own the recordingMachine instance, wiring its side-effecting actions
 *     (`engineStart`, `engineStop`) to the real engine via `.withConfig`;
 *   • subscribe to `onPitch` while recording and fan each frame into the shared
 *     values (frequency / clarity / midi / cents / a monotonic frame counter
 *     the Skia canvas reads to advance its scroll);
 *   • expose `start()` / `stop()` that drive both the engine and the machine and
 *     resolve the finished `RecordingHandle`.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';
import { useMachine } from '@xstate/react';

import { useAudioEngine } from '../../audio/useAudioEngine';
import type { PitchSample, RecordingHandle } from '../../audio/contract';
import {
  recordingMachine,
  type RecordingStateValue
} from '../../state/recordingMachine';

export interface RecordController {
  /** Request permission (if needed), start the engine, enter `recording`. */
  start(): Promise<void>;
  /** Stop the engine, run the machine through `analyzing`, resolve the handle. */
  stop(): Promise<RecordingHandle>;
  /** Latest detected fundamental in Hz (0 when unvoiced). UI thread. */
  sharedPitch: SharedValue<number>;
  /** Latest NSDF clarity, 0..1. UI thread. */
  sharedClarity: SharedValue<number>;
  /** Nearest MIDI note number, or -1 when unvoiced (shared values are numeric). */
  sharedMidi: SharedValue<number>;
  /** Cents deviation -50..50, or 0 when unvoiced. */
  sharedCents: SharedValue<number>;
  /** Monotonic counter bumped once per emitted frame; drives the scroll. */
  sharedFrame: SharedValue<number>;
  /** Coarse machine state for transport / status UI. */
  state: RecordingStateValue;
  /** True while actively capturing. */
  isRecording: boolean;
}

/** Sentinel written to `sharedMidi` for an unvoiced frame. */
export const UNVOICED_MIDI = -1;

export function useRecordController(): RecordController {
  const engine = useAudioEngine();
  // The engine hook returns a fresh object each render, but its methods are
  // stable callbacks bound to the singleton. Hold it in a ref so the machine
  // config and start/stop callbacks stay referentially stable (no churn, no
  // machine re-creation) while always invoking the live methods.
  const engineRef = useRef(engine);
  engineRef.current = engine;

  // ---- UI-thread shared values (the per-frame sink) ----
  const sharedPitch = useSharedValue(0);
  const sharedClarity = useSharedValue(0);
  const sharedMidi = useSharedValue(UNVOICED_MIDI);
  const sharedCents = useSharedValue(0);
  const sharedFrame = useSharedValue(0);

  // The live pitch subscription's unsubscribe, held across renders so stop()
  // can tear it down deterministically.
  const unsubRef = useRef<(() => void) | null>(null);

  const writeFrame = useCallback(
    (sample: PitchSample): void => {
      // Plain numeric assignments into shared values — no setState, no render.
      sharedPitch.value = sample.frequencyHz;
      sharedClarity.value = sample.clarity;
      sharedMidi.value = sample.midi ?? UNVOICED_MIDI;
      sharedCents.value = sample.cents ?? 0;
      sharedFrame.value = sharedFrame.value + 1;
    },
    [sharedPitch, sharedClarity, sharedMidi, sharedCents, sharedFrame]
  );

  const detach = useCallback((): void => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  // Machine with the engine side-effects injected. The machine stays pure; the
  // screen supplies what `recording`/`analyzing` entry actions actually do.
  const machine = useMemo(
    () =>
      recordingMachine.withConfig({
        actions: {
          engineStart: () => {
            // Subscribe to the live stream exactly once per recording.
            if (unsubRef.current == null) {
              unsubRef.current = engineRef.current.onPitch(writeFrame);
            }
          },
          engineStop: () => {
            detach();
          }
        }
      }),
    [writeFrame, detach]
  );

  const [snapshot, send] = useMachine(machine);

  // Reset the per-frame surface whenever we leave the recording state so a new
  // session starts from a clean line.
  const stateValue = snapshot.value as RecordingStateValue;
  useEffect(() => {
    if (stateValue === 'idle') {
      sharedPitch.value = 0;
      sharedClarity.value = 0;
      sharedMidi.value = UNVOICED_MIDI;
      sharedCents.value = 0;
      sharedFrame.value = 0;
    }
  }, [stateValue, sharedPitch, sharedClarity, sharedMidi, sharedCents, sharedFrame]);

  // Defensive cleanup on unmount — never leak a native subscription.
  useEffect(() => detach, [detach]);

  const start = useCallback(async (): Promise<void> => {
    // Enter the permission gate so a denial lands the machine in `error`.
    send({ type: 'REQUEST_PERMISSION' });
    const granted = await engineRef.current.requestPermission();
    if (!granted) {
      send({ type: 'PERMISSION_DENIED' });
      throw new Error('Microphone permission denied');
    }
    // `PERMISSION_GRANTED` drives the machine into `recording`, whose entry
    // action attaches the pitch subscription; then physically start the engine.
    send({ type: 'PERMISSION_GRANTED' });
    await engineRef.current.start();
  }, [send]);

  const stop = useCallback(async (): Promise<RecordingHandle> => {
    // `STOP` → analyzing (entry action detaches the subscription).
    send({ type: 'STOP' });
    const handle = await engineRef.current.stop();
    send({ type: 'ANALYZED', data: handle });
    return handle;
  }, [send]);

  return {
    start,
    stop,
    sharedPitch,
    sharedClarity,
    sharedMidi,
    sharedCents,
    sharedFrame,
    state: stateValue,
    isRecording: stateValue === 'recording'
  };
}

export default useRecordController;
