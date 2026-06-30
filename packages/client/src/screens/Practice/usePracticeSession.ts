/**
 * usePracticeSession — orchestrates one practice take against a target melody.
 *
 * Wraps {@link useRecordController} (engine + shared values + machine) and adds:
 *   - building the `TargetNote[]` from the chosen catalogue melody;
 *   - the reference presentation, chosen by the audio route:
 *       headphones → play-along (reference plays WHILE recording);
 *       speaker    → count-in (preview the melody once, then record in silence);
 *   - phase reporting for the UI.
 *
 * The per-frame pitch stream still flows only through the controller's shared
 * values (UI thread) — this hook adds no per-frame work. Auto-stop after the
 * melody's length is left to the screen (it owns the transport timer), keeping
 * this hook free of timer/teardown races.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { findMelody, melodyDurationMs, type TargetNote } from 'logic';
import { type SharedValue } from 'react-native-reanimated';

import { createReferenceTonePlayer } from '../../audio/referenceTone';
import { detectHeadphonesConnected } from '../../audio/outputRoute';
import {
  DEFAULT_ENGINE_CONFIG,
  type RecordingHandle
} from '../../audio/contract';
import type { PracticeParams } from '../../navigation/types';
import { useRecordController } from '../Record/useRecordController';

export type PracticePhase =
  | 'idle'
  | 'preparing'
  | 'countIn'
  | 'recording'
  | 'analyzing';

export interface UsePracticeSessionValue {
  phase: PracticePhase;
  /** The reference melody being practised. */
  targets: TargetNote[];
  /** Length of the melody (and so the recording), in ms. */
  durationMs: number;
  /** Transport clock (frames) + latest pitch, for the overlay (UI thread). */
  sharedMidi: SharedValue<number>;
  sharedFrame: SharedValue<number>;
  /** Frames/sec the transport advances at (the engine emit rate). */
  fps: number;
  /**
   * Run the pre-roll (count-in or, with headphones, nothing) and start
   * recording. Resolves once recording has begun; rejects if mic permission is
   * denied. The screen stops the take after {@link durationMs}.
   */
  begin(): Promise<void>;
  /** Stop the engine and resolve the finished capture for analysis. */
  finish(): Promise<RecordingHandle>;
  /** Abort the session (stop reference + engine) and return to idle. */
  cancel(): Promise<void>;
}

/** Silent gap between the count-in preview and the start of recording. */
const COUNT_IN_GAP_MS = 600;

/** A simple cancellable delay. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function usePracticeSession(
  params: PracticeParams
): UsePracticeSessionValue {
  const { melodyId, rootMidi, noteDurationMs } = params;
  const controller = useRecordController();

  const targets = useMemo<TargetNote[]>(() => {
    const melody = findMelody(melodyId);
    return melody ? melody.build({ rootMidi, noteDurationMs }) : [];
  }, [melodyId, rootMidi, noteDurationMs]);

  const durationMs = useMemo(() => melodyDurationMs(targets), [targets]);

  const playerRef = useRef(createReferenceTonePlayer());
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<PracticePhase>('idle');

  const begin = useCallback(async (): Promise<void> => {
    cancelledRef.current = false;
    const player = playerRef.current;
    setPhase('preparing');

    try {
      const headphones = await detectHeadphonesConnected();
      if (cancelledRef.current) {
        return;
      }

      if (!headphones) {
        // Speaker: preview the whole melody, then a short silence, then record.
        setPhase('countIn');
        player.play(targets);
        await wait(durationMs + COUNT_IN_GAP_MS);
        player.stop();
        if (cancelledRef.current) {
          return;
        }
      }

      setPhase('recording');
      await controller.start();

      if (headphones) {
        // Headphones: the reference plays along while recording (the mic won't
        // pick it up), so the singer can follow in real time.
        player.play(targets);
      }
    } catch (error) {
      player.stop();
      setPhase('idle');
      throw error;
    }
  }, [controller, targets, durationMs]);

  const finish = useCallback(async (): Promise<RecordingHandle> => {
    playerRef.current.stop();
    setPhase('analyzing');
    const handle = await controller.stop();
    setPhase('idle');
    return handle;
  }, [controller]);

  const cancel = useCallback(async (): Promise<void> => {
    cancelledRef.current = true;
    playerRef.current.stop();
    if (controller.isRecording) {
      try {
        await controller.stop();
      } catch {
        // Already stopped / never started — nothing to clean up.
      }
    }
    setPhase('idle');
  }, [controller]);

  return {
    phase,
    targets,
    durationMs,
    sharedMidi: controller.sharedMidi,
    sharedFrame: controller.sharedFrame,
    fps: DEFAULT_ENGINE_CONFIG.emitRateHz,
    begin,
    finish,
    cancel
  };
}

export default usePracticeSession;
