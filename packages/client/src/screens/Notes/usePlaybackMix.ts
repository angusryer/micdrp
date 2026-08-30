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

import { type SharedValue } from 'react-native-reanimated';

import { usePlayback, type PlaybackState } from './usePlayback';
import { useLatest } from './useLatest';
import NativeSynth from '../../specs/NativeSynth';
import { waveOf } from '../../audio/voices';
import { AUDITION_BUS } from '../../audio/synthPlayer';
import { trackBus } from './trackRegistry';
import {
  sameMix,
  TRACK_ORDER,
  type PlaybackMix,
  type TrackLevels,
  type TrackVoices
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
   * The layers, as they were sung rather than as they were read
   * (INV-NOTES-134). One voice for all of them: they were sung against the
   * same take, so there is one moment for them to start at.
   */
  layers?: MixAccompaniment;
  /** The root movement read from the take, on its own track (INV-NOTES-135). */
  bass?: MixAccompaniment;
  /** Which voice each track speaks in (INV-NOTES-144). */
  voices?: TrackVoices;
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
  /**
   * The same moment as `positionMs`, read every frame on the UI thread
   * (INV-NOTES-136). For the drawn playhead, which has to move smoothly; the
   * number above it is read to the second and costs a render.
   */
  drawnPositionMs: SharedValue<number>;
  /** Start at a moment in the take. Omitted, from the beginning. */
  play(fromMs?: number): Promise<void>;
  /** Stop, then resume this many ms earlier — never before the start. */
  rewind(byMs?: number): Promise<void>;
  /**
   * Fall silent and leave the head where the take reached, so the moment
   * stopped on stays there to be read and the next press carries on from it
   * (INV-NOTES-152).
   */
  pause(): Promise<void>;
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
  layers,
  bass,
  levels,
  voices
}: UsePlaybackMixOptions): MixedPlayback {
  const {
    state: takeState,
    elapsedMs: takeElapsedMs,
    positionMs,
    drawnPositionMs,
    play: playTake,
    pause: pauseTake,
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
    layers?.setLevel?.(levels.layers);
    bass?.setLevel?.(levels.bass);
  }, [levels, accompaniment, voice, count, rhythm, layers, bass, setTakeLevel]);

  // What each track sounds like, told to the engine directly rather than
  // through the players: a timbre belongs to a bus, and a bus is what a track
  // already is (INV-NOTES-144).
  useEffect(() => {
    if (voices == null) {
      return;
    }
    for (const track of TRACK_ORDER) {
      NativeSynth?.setBusWave?.(trackBus(track), waveOf(voices[track]));
    }
    // The bus that answers "what is this note" speaks in the melody's voice
    // (INV-NOTES-175). It was whatever the engine starts with, so checking a
    // note and hearing it play compared two different sounds.
    NativeSynth?.setBusWave?.(AUDITION_BUS, waveOf(voices.melody));
  }, [voices]);

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

  // Read through refs so each voice follows the transport and only the
  // transport: re-voicing the chords mid-take (an edit, a re-render) must not
  // restart them underneath a take that never stopped. Likewise the take's
  // own switch — a choice that drops the take must not re-schedule the
  // backdrop on its way to stopping everything.
  const latest = useLatest(accompaniment);
  const takeWanted = useLatest(wantsTake);
  const latestVoice = useLatest(voice);
  const latestRhythm = useLatest(rhythm);
  const latestCount = useLatest(count);
  const latestLayers = useLatest(layers);
  const latestBass = useLatest(bass);

  const wantsCount = mix.count;
  const wantsRhythm = mix.rhythm;
  const wantsLayers = mix.layers;
  const wantsBass = mix.bass;

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
      [latestCount.current, wantsCount],
      [latestLayers.current, wantsLayers],
      [latestBass.current, wantsBass]
    ] as const;
    for (const [player, wanted] of voices) {
      if (running && wanted) {
        player?.start(at);
      } else {
        player?.stop();
      }
    }
  }, [
    state,
    wantsChords,
    wantsVoice,
    wantsRhythm,
    wantsCount,
    wantsLayers,
    wantsBass,
    takeElapsedMs
  ]);

  const stop = useCallback(async (): Promise<void> => {
    clearEndTimer();
    setChordsRunning(false);
    await stopTake();
  }, [clearEndTimer, stopTake]);

  /**
   * The same silence, with the moment kept (INV-NOTES-152).
   *
   * Where the take reached becomes where a press would start, so pausing to
   * look at what is under the head and then carrying on is one idea rather
   * than a stop followed by finding the place again.
   *
   * With the take off there is nothing to keep: that transport is a timer
   * over the other tracks and reads no clock, so its head never moved.
   */
  const pause = useCallback(async (): Promise<void> => {
    clearEndTimer();
    setChordsRunning(false);
    const reachedMs = await pauseTake();
    if (takeWanted.current) {
      setCueMs(reachedMs);
    }
  }, [clearEndTimer, pauseTake, takeWanted]);

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
      wantsCount ? (latestCount.current?.durationMs ?? 0) : 0,
      wantsLayers ? (latestLayers.current?.durationMs ?? 0) : 0,
      wantsBass ? (latestBass.current?.durationMs ?? 0) : 0
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
  /**
   * Move the head back, and decide nothing about sound (INV-NOTES-160).
   *
   * It used to start the take whatever state it was in, so the only way to
   * move the head backwards was to begin listening — and going back to look
   * at something is not the same act as going back to hear it.
   *
   * From where the head actually is, too. The anchor says how long the audio
   * has been running, which is nothing before the first play and stale after
   * a stop, so a rewind from a stopped take went somewhere unrelated to the
   * head the singer was looking at.
   */
  const rewind = useCallback(
    async (byMs = REWIND_MS): Promise<void> => {
      const isPlaying = state === 'playing';
      const from = isPlaying ? takeElapsedMs() : cueMs;
      const to = Math.max(0, from - byMs);
      if (!isPlaying) {
        setCueMs(to);
        return;
      }
      // Sounding, and it goes on sounding from the new moment: this transport
      // starts at a moment rather than jumping to one, so moving means
      // stopping and starting again.
      await stop();
      setCueMs(to);
      await play(to);
    },
    [state, takeElapsedMs, cueMs, stop, play]
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
    pause,
    stop,
    rewind,
    positionMs: state === 'playing' ? positionMs : cueMs,
    drawnPositionMs,
    cueTo
  };
}

export default usePlaybackMix;
