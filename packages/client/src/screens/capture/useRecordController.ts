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
import { markBusy } from '../../updates';

export interface RecordController {
  /** Request permission (if needed), start the engine, enter `recording`. */
  start(): Promise<void>;
  /** Stop the engine, run the machine through `analyzing`, resolve the handle. */
  stop(): Promise<RecordingHandle>;
  /**
   * Return to `idle` from a terminal state without recording. `start` does
   * this itself, so this is for a screen that wants to clear a result or an
   * error on its own (INV-NOTES-013).
   */
  reset(): void;
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
  /**
   * How far into the capture we are, in ms on the capture's own timeline.
   *
   * The timeline the melody is written on, not the wall clock and not the
   * synth's — a beat tapped while singing has to land where the notes land
   * (INV-NOTES-137). Taken from the last analysed frame and carried forward
   * by the time since it arrived, because frames land every hop and a finger
   * does not wait for one.
   */
  elapsedMs(): number;
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

  /** The last frame's place on the capture's timeline, and when it landed. */
  const lastFrame = useRef({ atMs: 0, seenAt: 0 });

  const writeFrame = useCallback(
    (sample: PitchSample): void => {
      lastFrame.current = { atMs: sample.timestampMs, seenAt: Date.now() };
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
      recordingMachine.provide({
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
  const stateValue: RecordingStateValue = snapshot.value;
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

  // Hold back the update prompt for as long as a take is running (INV-UPD-004).
  // A modal over a live take costs the take, and unlike an update, a take
  // cannot be redone identically. Analysis counts as running too: the capture
  // is not yet a note, so a reload would lose it.
  useEffect(() => {
    if (stateValue !== 'recording' && stateValue !== 'analyzing') {
      return undefined;
    }
    return markBusy('capture');
  }, [stateValue]);

  const start = useCallback(async (): Promise<void> => {
    // A previous capture's last frame is not this one's first.
    lastFrame.current = { atMs: 0, seenAt: 0 };
    // Leave any terminal state first. After a capture the machine sits in
    // `result`, and after a failure in `error`; neither accepts
    // REQUEST_PERMISSION, so without this the record control does nothing for
    // the rest of the session and only a relaunch clears it (INV-NOTES-013).
    // RESET is ignored from `idle`, so this is safe on the first capture too.
    send({ type: 'RESET' });
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

  const reset = useCallback((): void => {
    send({ type: 'RESET' });
  }, [send]);

  return {
    start,
    stop,
    reset,
    sharedPitch,
    sharedClarity,
    sharedMidi,
    sharedCents,
    sharedFrame,
    state: stateValue,
    isRecording: stateValue === 'recording',
    elapsedMs: useCallback(() => {
      const { atMs, seenAt } = lastFrame.current;
      return seenAt === 0 ? 0 : atMs + Math.max(0, Date.now() - seenAt);
    }, [])
  };
}

export default useRecordController;
