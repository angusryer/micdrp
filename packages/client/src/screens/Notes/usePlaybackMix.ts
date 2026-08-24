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
import {
  sameMix,
  type PlaybackMix,
  type TrackLevels
} from './playbackTracks';

/** How far back a press of rewind goes. About one phrase of a sung idea. */
export const REWIND_MS = 5000;

export type { PlaybackMix };

export interface MixAccompaniment {
  /** Schedule the backdrop against a take already `offsetMs` in. */
  start: (offsetMs?: number) => void;
  stop: () => void;
  /** How long the backdrop runs, in ms; 0 when there is nothing to sound. */
  durationMs: number;
  /** How loud it sits in the mix, 0..1. Absent on a voice with no level. */
  setLevel?: (level: number) => void;
  /**
   * How long everything else waits for this voice before it begins. Only the
   * count has one: it must finish counting before the beat it counts to
   * (INV-NOTES-088).
   */
  leadInMs?: number;
}

export interface UsePlaybackMixOptions {
  /** Produce a playable URL for the take. Called only when a take is played. */
  resolveAudioUri: () => Promise<string | null>;
  mix: PlaybackMix;
  /** How loud each track sits, independent of whether it is on. */
  levels?: TrackLevels;
  accompaniment?: MixAccompaniment;
  /** The click counting the take in and keeping time (INV-NOTES-119). */
  count?: MixAccompaniment;
  /** The struck sounds read out of the take (INV-NOTES-120). */
  rhythm?: MixAccompaniment;
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
  /** Start at a moment in the take. Omitted, from the beginning. */
  play(fromMs?: number): Promise<void>;
  /** Stop, then resume this many ms earlier — never before the start. */
  rewind(byMs?: number): Promise<void>;
  /** Where the take is now, or where it will start from, in ms. */
  positionMs: number;
  /**
   * Put the playhead somewhere without starting anything.
   *
   * Moving the head is not a transport command: a scrubber that played what
   * it passed over would make placing the head impossible without hearing it
   * (INV-NOTES-091).
   */
  cueTo: (ms: number) => void;
  stop(): Promise<void>;
}

export function usePlaybackMix({
  resolveAudioUri,
  mix,
  accompaniment,
  voice,
  count,
  rhythm,
  levels
}: UsePlaybackMixOptions): MixedPlayback {
  const {
    state: takeState,
    elapsedMs: takeElapsedMs,
    positionMs,
    play: playTake,
    stop: stopTake,
    setLevel: setTakeLevel
  } = usePlayback({ resolveAudioUri });
  // Applied on change rather than at the start of a press: a level moved
  // while something is sounding must be heard now, not next time.
  useEffect(() => {
    if (!levels) {
      return;
    }
    setTakeLevel(levels.take);
    accompaniment?.setLevel?.(levels.chords);
    voice?.setLevel?.(levels.melody);
    count?.setLevel?.(levels.count);
    rhythm?.setLevel?.(levels.rhythm);
  }, [levels, accompaniment, voice, count, rhythm, setTakeLevel]);

  const wantsTake = mix.take;
  const wantsChords = mix.chords;
  const wantsVoice = mix.melody;

  // The transport for whatever sounds without a take under it — the chords,
  // the melody, or both. No decode, so nothing to be loading or in error
  // over: it is running or it is not.
  const [chordsRunning, setChordsRunning] = useState(false);
  // Where a press would start from. It is where the take stopped, or wherever
  // the playhead was last put.
  const [cueMs, setCueMs] = useState(0);
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

  const latestRhythm = useRef(rhythm);
  useEffect(() => {
    latestRhythm.current = rhythm;
  }, [rhythm]);

  const latestCount = useRef(count);
  useEffect(() => {
    latestCount.current = count;
  }, [count]);

  const wantsCount = mix.count;
  const wantsRhythm = mix.rhythm;

  /**
   * Every voice, started against one reading of the clock.
   *
   * One reading because each voice used to take its own, in its own effect —
   * so the chords, the melody, the drums and the click were each placed
   * against a slightly different idea of where the take had reached, and were
   * out of time with each other as well as with it (INV-NOTES-126).
   *
   * Placed where the take has reached rather than at its top: the take is
   * already running by the time this commits (INV-NOTES-020). A voice sounding
   * without a take has nothing to catch up to and starts at zero.
   */
  useEffect(() => {
    const at = takeWanted.current ? takeElapsedMs() : 0;
    const running = state === 'playing';
    const voices = [
      [latest.current, wantsChords],
      [latestVoice.current, wantsVoice],
      [latestRhythm.current, wantsRhythm],
      [latestCount.current, wantsCount]
    ] as const;
    for (const [player, wanted] of voices) {
      if (running && wanted) {
        player?.start(at);
      } else {
        player?.stop();
      }
    }
  }, [state, wantsChords, wantsVoice, wantsRhythm, wantsCount, takeElapsedMs]);

  const stop = useCallback(async (): Promise<void> => {
    clearEndTimer();
    setChordsRunning(false);
    await stopTake();
  }, [clearEndTimer, stopTake]);

  const play = useCallback(async (fromMs = cueMs): Promise<void> => {
    // The count starts now; everything else waits for it to finish. Timed
    // rather than sample-accurate on purpose — a count is a scaffold to come
    // in on, not part of the recording.
    const leadInMs = wantsCount ? (latestCount.current?.leadInMs ?? 0) : 0;
    if (leadInMs > 0) {
      clearEndTimer();
      setChordsRunning(true);
      latestCount.current?.start(0);
      await new Promise((resolve) => setTimeout(resolve, leadInMs));
      setChordsRunning(false);
    }
    if (wantsTake) {
      await playTake(fromMs);
      return;
    }
    // With the take off, whatever is left is the transport, and it runs for
    // as long as the longest of them. With everything off there is none, so
    // the press sounds nothing rather than the track just turned off.
    const durationMs = Math.max(
      wantsChords ? (latest.current?.durationMs ?? 0) : 0,
      wantsVoice ? (latestVoice.current?.durationMs ?? 0) : 0,
      wantsCount ? (latestCount.current?.durationMs ?? 0) : 0
    );
    if (durationMs <= 0) {
      return;
    }
    clearEndTimer();
    setChordsRunning(true);
    endTimer.current = setTimeout(() => setChordsRunning(false), durationMs);
  }, [
    wantsTake,
    wantsChords,
    wantsVoice,
    wantsCount,
    playTake,
    clearEndTimer,
    cueMs
  ]);

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

  // One performance heard three ways, so they move together: a backdrop that
  // restarted from the top while the take resumed in the middle would put a
  // different chord under every note (INV-NOTES-069).
  const rewind = useCallback(
    async (byMs = REWIND_MS): Promise<void> => {
      const to = Math.max(0, takeElapsedMs() - byMs);
      await stop();
      setCueMs(to);
      await play(to);
    },
    [takeElapsedMs, stop, play]
  );

  // Playing, it is where the take has reached; stopped, it is where a press
  // would start — one mark for one idea, rather than a position that means
  // nothing until something is sounding.
  const cueTo = useCallback(
    (ms: number) => {
      setCueMs(Math.max(0, ms));
      // Moving the head while something is sounding stops it rather than
      // seeking live: this transport can only start at a moment, not jump to
      // one, and a stutter would be a worse answer than a stop.
      if (state === 'playing') {
        void stop();
      }
    },
    [state, stop]
  );

  return {
    state,
    play,
    stop,
    rewind,
    positionMs: state === 'playing' ? positionMs : cueMs,
    cueTo
  };
}

export default usePlaybackMix;
