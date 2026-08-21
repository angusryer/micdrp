/**
 * usePlaybackMix — one transport over two sources.
 *
 * A note can be heard three ways: the take alone, the chord backdrop alone, or
 * the two together, which is what play gives until something else is chosen.
 * This owns which of them a press sounds (INV-NOTES-019) and keeps them under
 * a single transport, so the play control is never a lie about what is running.
 *
 * The take's machine is `usePlayback`. The chords have no decode step, so when
 * they sound alone the backdrop *is* the transport: the press schedules it and
 * a timer the length of the progression hands the control back to play when it
 * runs out (INV-NOTES-018).
 *
 * Choosing the chords alone never resolves the audio URL, so a press that
 * plays no take mints no file token and asks the backend for nothing.
 * Changing the choice stops whatever is sounding — a mix applied halfway would
 * make what is heard depend on when the choice was made.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayback, type PlaybackState } from './usePlayback';

/** What a press sounds. `both` is the default. */
export type PlaybackMix = 'take' | 'chords' | 'both';

export interface MixAccompaniment {
  /** Schedule the backdrop against a take already `offsetMs` in. */
  start: (offsetMs?: number) => void;
  stop: () => void;
  /** How long the backdrop runs, in ms; 0 when there is nothing to sound. */
  durationMs: number;
}

export interface UsePlaybackMixOptions {
  /** Produce a playable URL for the take. Called only when a take is played. */
  resolveAudioUri: () => Promise<string | null>;
  mix: PlaybackMix;
  accompaniment?: MixAccompaniment;
  /**
   * A voice that follows the take itself rather than the chord choice.
   *
   * The detected melody belongs here. Hanging it off the accompaniment made
   * it a passenger on a decision about chords: with the mix on take-only the
   * accompaniment never starts, so the melody was silent however loud it was
   * set (INV-NOTES-027). Whether you want to hear what was read is a separate
   * question from whether you want harmony under it.
   */
  voice?: MixAccompaniment;
}

export interface MixedPlayback {
  state: PlaybackState;
  play(): Promise<void>;
  stop(): Promise<void>;
}

export function usePlaybackMix({
  resolveAudioUri,
  mix,
  accompaniment,
  voice
}: UsePlaybackMixOptions): MixedPlayback {
  const {
    state: takeState,
    elapsedMs: takeElapsedMs,
    play: playTake,
    stop: stopTake
  } = usePlayback({ resolveAudioUri });
  const wantsTake = mix !== 'chords';
  const wantsChords = mix !== 'take';

  // The chords-alone transport: no decode, so nothing to be loading or in
  // error over — it is running or it is not.
  const [chordsRunning, setChordsRunning] = useState(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearEndTimer = useCallback(() => {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  }, []);
  useEffect(() => clearEndTimer, [clearEndTimer]);

  const state: PlaybackState = wantsTake
    ? takeState
    : chordsRunning
      ? 'playing'
      : 'stopped';

  // Read through a ref so the backdrop follows the transport and only the
  // transport: re-voicing the chords mid-take (an edit, a re-render) must not
  // restart it underneath a take that never stopped.
  const latest = useRef(accompaniment);
  useEffect(() => {
    latest.current = accompaniment;
  }, [accompaniment]);
  // Read the same way, and for the same reason: a choice that drops the take
  // must not re-schedule the backdrop on its way to stopping everything.
  const takeWanted = useRef(wantsTake);
  useEffect(() => {
    takeWanted.current = wantsTake;
  }, [wantsTake]);

  const latestVoice = useRef(voice);
  useEffect(() => {
    latestVoice.current = voice;
  }, [voice]);

  // Follows the take, not the chord choice.
  useEffect(() => {
    if (state === 'playing' && takeWanted.current) {
      latestVoice.current?.start(takeElapsedMs());
    } else {
      latestVoice.current?.stop();
    }
  }, [state, takeElapsedMs]);

  useEffect(() => {
    if (state === 'playing' && wantsChords) {
      // The take is already running by the time this commits, so the backdrop
      // is placed where the take has reached rather than at its top
      // (INV-NOTES-020). Chords alone have nothing to catch up to.
      latest.current?.start(takeWanted.current ? takeElapsedMs() : 0);
    } else {
      latest.current?.stop();
    }
  }, [state, wantsChords, takeElapsedMs]);

  const stop = useCallback(async (): Promise<void> => {
    clearEndTimer();
    setChordsRunning(false);
    await stopTake();
  }, [clearEndTimer, stopTake]);

  const play = useCallback(async (): Promise<void> => {
    if (wantsTake) {
      await playTake();
      return;
    }
    const durationMs = latest.current?.durationMs ?? 0;
    if (durationMs <= 0) {
      return;
    }
    clearEndTimer();
    setChordsRunning(true);
    endTimer.current = setTimeout(() => setChordsRunning(false), durationMs);
  }, [wantsTake, playTake, clearEndTimer]);

  // A choice made mid-playback stops what is sounding, so the next press is
  // the whole of the mix now chosen rather than half of two.
  const chosen = useRef(mix);
  useEffect(() => {
    if (chosen.current === mix) {
      return;
    }
    chosen.current = mix;
    void stop();
  }, [mix, stop]);

  return { state, play, stop };
}

export default usePlaybackMix;
