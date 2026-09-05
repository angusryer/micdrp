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
import { useCallback, useEffect, useRef } from 'react';

import { type SharedValue } from 'react-native-reanimated';

import { usePlayback, type PlaybackState } from './usePlayback';
import { useLatest } from './useLatest';
import { setBusWave } from '../../audio/engineBus';
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
   * How much the take is lifted before its level is applied
   * (INV-NOTES-141).
   *
   * A recording at a level of one is already as loud as it was sung. Without
   * this the match could only push the synthesized tracks down towards a
   * quiet take, and against one quieter than its floor it ran out of room.
   * One means a take already at the reference, which is most of them.
   */
  takeMakeUp?: number;
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
  play(fromMs?: number, withoutCount?: boolean): Promise<void>;
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
  /**
   * Take hold of the head for a continuous gesture (INV-TPORT-018).
   *
   * Anything sounding stops, and is remembered so the release can carry
   * on from wherever the head was let go. Without this a drag is a seek
   * per frame, and playing, each of those is a full stop, a file token
   * minted, a decode and a reschedule — sixty times a second.
   */
  grabHead(): void;
  /** Put the head down at a moment, and carry on if it was sounding. */
  dropHead(ms: number): void;
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
  voices,
  takeMakeUp = 1
}: UsePlaybackMixOptions): MixedPlayback {
  const {
    state: takeState,
    elapsedMs: takeElapsedMs,
    positionMs,
    drawnPositionMs,
    play: playTake,
    pause: pauseTake,
    stop: stopTake,
    seek: seekTake,
    cueMs,
    setLevel: setTakeLevel
  } = usePlayback({ resolveAudioUri });
  // Applied on change rather than at the start of a press: a level moved
  // while something is sounding must be heard now, not next time.
  useEffect(() => {
    if (!levels) {
      return;
    }
    // Muting is a level, not a stop (INV-TPORT-013). The take runs
    // whatever the mix says; turning it off makes it silent and leaves
    // the transport alone, which is how every mixing desk works.
    setTakeLevel(mix.take ? levels.take * takeMakeUp : 0);
    accompaniment?.setLevel?.(levels.chords);
    voice?.setLevel?.(levels.melody);
    count?.setLevel?.(levels.count);
    rhythm?.setLevel?.(levels.rhythm);
    layers?.setLevel?.(levels.layers);
    bass?.setLevel?.(levels.bass);
  }, [
    levels,
    mix.take,
    takeMakeUp,
    accompaniment,
    voice,
    count,
    rhythm,
    layers,
    bass,
    setTakeLevel
  ]);

  // What each track sounds like, told to the engine directly rather than
  // through the players: a timbre belongs to a bus, and a bus is what a track
  // already is (INV-NOTES-144).
  useEffect(() => {
    if (voices == null) {
      return;
    }
    for (const track of TRACK_ORDER) {
      setBusWave(trackBus(track), waveOf(voices[track]));
    }
    // The bus that answers "what is this note" speaks in the melody's voice
    // (INV-NOTES-175). It was whatever the engine starts with, so checking a
    // note and hearing it play compared two different sounds.
    setBusWave(AUDITION_BUS, waveOf(voices.melody));
  }, [voices]);

  const wantsChords = mix.chords;
  const wantsVoice = mix.melody;

  // The transport for whatever sounds without a take under it — the chords,
  // the melody, or both. No decode, so nothing to be loading or in error
  // over: it is running or it is not.

  // Where a press would start from. It is where the take stopped, or wherever
  // the playhead was last put.
  // No cue of its own. The transport below holds the one there is, and
  // a screen keeping a second copy is how a seek came to move one while
  // every display drew the other (INV-TPORT-007).

  /**
   * What the transport is doing. The take's, always (INV-TPORT-013).
   *
   * There was a second running-state here for the case where the take
   * was muted, with an end timer of its own — a state machine kept in
   * parallel with the real one, because the transport had been defined
   * as "the take is sounding" rather than "time is passing". It is a
   * level now, and this is the only answer there is.
   */
  const state: PlaybackState = takeState;

  // Read through refs so each voice follows the transport and only the
  // transport: re-voicing the chords mid-take (an edit, a re-render) must not
  // restart them underneath a take that never stopped. Likewise the take's
  // own switch — a choice that drops the take must not re-schedule the
  // backdrop on its way to stopping everything.
  const latest = useLatest(accompaniment);
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
    const at = takeElapsedMs();
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

  /**
   * Which press is the current one (INV-NOTES-204).
   *
   * Play waits out the count on a timer, and a press has to be
   * cancellable from the moment it is made rather than from the moment it
   * starts sounding. Anything resuming after an await checks this first —
   * the same guard the tone player keeps for the same reason.
   */
  const run = useRef(0);



  const stop = useCallback(async (): Promise<void> => {
    run.current += 1;
    await stopTake();
  }, [stopTake]);

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
    run.current += 1;
    // The moment held is the transport's answer; nothing here records it.
    await pauseTake();
  }, [pauseTake]);

  const play = useCallback(async (
    fromMs = cueMs,
    /**
     * Skip the count. A rewind is carrying on listening from a moment
     * further back, and counting somebody in again each time they go back
     * to hear a phrase turns one press into several seconds of waiting —
     * which is what made rewinding feel like it had done nothing.
     */
    withoutCount = false
  ): Promise<void> => {
    const mine = (run.current += 1);
    // The count starts now; everything else waits for it to finish. Timed
    // rather than sample-accurate on purpose — a count is a scaffold to come
    // in on, not part of the recording.
    const leadInMs =
      wantsCount && !withoutCount ? (latestCount.current?.leadInMs ?? 0) : 0;
    if (leadInMs > 0) {
      latestCount.current?.start(0);
      await new Promise((resolve) => setTimeout(resolve, leadInMs));
      // Stopped, paused, or pressed again while the count ran. Carrying on
      // would start a take after it had been stopped, and leave a transport
      // that already reads stopped with no way to end it (INV-NOTES-204).
      if (mine !== run.current) {
        return;
      }
    }
    // The take carries the transport whether or not it is audible.
    await playTake(fromMs);
  }, [wantsCount, playTake, cueMs]);

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
        await seekTake(to);
        return;
      }
      // Sounding, and it goes on sounding from the new moment: this transport
      // starts at a moment rather than jumping to one, so moving means
      // stopping and starting again.
      await stop();
      await seekTake(to);
      await play(to, true);
    },
    [state, takeElapsedMs, cueMs, seekTake, stop, play]
  );

  // Playing, it is where the take has reached; stopped, it is where a press
  // would start — one mark for one idea, rather than a position that means
  // nothing until something is sounding.
  const cueTo = useCallback(
    (ms: number) => {
      // The transport decides what a seek means: it moves the head, and
      // where something was sounding it starts again from the new moment
      // rather than jumping to it (INV-TPORT-007).
      void seekTake(Math.max(0, ms));
    },
    [seekTake]
  );

  /**
   * Whether the gesture holding the head interrupted something sounding.
   *
   * A ref because the gesture reads it between renders, and because it
   * is an answer about the press rather than anything drawn.
   */
  const heldSounding = useRef(false);

  const grabHead = useCallback((): void => {
    // Loading counts: a start is on its way, and the drag is cancelling
    // it (INV-TPORT-016).
    heldSounding.current = state === 'playing' || state === 'loading';
    if (heldSounding.current) {
      void stop();
    }
  }, [state, stop]);

  const dropHead = useCallback(
    (ms: number): void => {
      const at = Math.max(0, ms);
      const carryOn = heldSounding.current;
      heldSounding.current = false;
      if (!carryOn) {
        void seekTake(at);
        return;
      }
      // Without the count. A scrub is carrying on listening from a moment
      // you picked, and counting somebody in each time turns one gesture
      // into several seconds of waiting.
      void (async () => {
        await seekTake(at);
        await play(at, true);
      })();
    },
    [seekTake, play]
  );

  return {
    state,
    play,
    pause,
    stop,
    rewind,
    positionMs: state === 'playing' ? positionMs : cueMs,
    drawnPositionMs,
    cueTo,
    grabHead,
    dropHead
  };
}

export default usePlaybackMix;
