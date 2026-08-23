/**
 * usePlaybackMix — one transport over three tracks.
 *
 * A note has up to three of them: the recorded take, the chord backdrop read
 * from it, and the melody read from it. Each is turned on and off on its own,
 * and a press sounds exactly those left on (INV-NOTES-019). This owns that and
 * keeps them under a single transport, so the play control is never a lie about
 * what is running. Why toggles rather than one exclusive pick, and what each
 * track means, is `playbackTracks`.
 *
 * The take's machine is `usePlayback`. The chords have no decode step, so when
 * they sound alone the backdrop *is* the transport: the press schedules it and
 * a timer the length of the progression hands the control back to play when it
 * runs out (INV-NOTES-018).
 *
 * The take turned off never resolves the audio URL, so a press that plays no
 * take mints no file token and asks the backend for nothing. Turning any track
 * stops whatever is sounding — a mix applied halfway would make what is heard
 * depend on when the track was turned.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePlayback, type PlaybackState } from './usePlayback';
import { sameMix, type PlaybackMix } from './playbackTracks';

export type { PlaybackMix };

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
   * A voice that follows the take itself rather than the chord track.
   *
   * The detected melody belongs here. Hanging it off the accompaniment made it
   * a passenger on a decision about chords: with the chords off the
   * accompaniment never starts, so the melody was silent however loud it was
   * set (INV-NOTES-027) — which is why it is a track of its own in `mix`.
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
  const wantsTake = mix.take;
  const wantsChords = mix.chords;
  // The melody rides the take's clock, so it cannot sound without one.
  const wantsVoice = mix.melody && mix.take;

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

  // Follows the take, not the chord track — and only when its own is on.
  useEffect(() => {
    if (state === 'playing' && wantsVoice) {
      latestVoice.current?.start(takeElapsedMs());
    } else {
      latestVoice.current?.stop();
    }
  }, [state, wantsVoice, takeElapsedMs]);

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
    // With the take off the chords are the transport; with both off there is
    // none, so the press sounds nothing rather than the track just turned off.
    const durationMs = wantsChords ? (latest.current?.durationMs ?? 0) : 0;
    if (durationMs <= 0) {
      return;
    }
    clearEndTimer();
    setChordsRunning(true);
    endTimer.current = setTimeout(() => setChordsRunning(false), durationMs);
  }, [wantsTake, wantsChords, playTake, clearEndTimer]);

  // A track turned mid-playback stops what is sounding, so the next press is
  // the whole of the mix as it now stands rather than half of two.
  const turned = useRef(mix);
  useEffect(() => {
    if (sameMix(turned.current, mix)) {
      return;
    }
    turned.current = mix;
    void stop();
  }, [mix, stop]);

  return { state, play, stop };
}

export default usePlaybackMix;
