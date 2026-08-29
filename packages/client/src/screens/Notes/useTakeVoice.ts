/**
 * The take, sounding through the one engine (INV-NOTES-133).
 *
 * The recording is decoded once into a slot on the native engine
 * and then scheduled by the same call, on the same clock, at the same bus
 * levels as every synthesized voice. There is no second graph to line up
 * with, so a backdrop and the voice it was read from are in time by
 * construction rather than by correction.
 *
 * Which also settles what a suspended context used to cost. An engine that is
 * already running owns its output and has nothing to ask the session for, so
 * a take under a live capture is a scheduling question rather than a refusal
 * (INV-NOTES-127, INV-NOTES-128).
 *
 * The decode is the one slow step and it happens once per take rather than
 * once per press, off the main thread.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import NativeSynth from '../../specs/NativeSynth';
import { SCHEDULE_LEAD_MS, audioNowMs } from '../../audio/audioClock';
import { useDrawnPosition, usePlaybackClock } from './usePlaybackClock';
import { useTakeAnchor } from './useTakeAnchor';
import { trackBus } from './trackRegistry';
import { TAKE_SLOT } from './sampleSlots';
import type { Playback, PlaybackState, UsePlaybackOptions } from './playbackShape';

export function useTakeVoice({
  resolveAudioUri
}: UsePlaybackOptions): Playback {
  const [state, setState] = useState<PlaybackState>('stopped');
  const [fromMs, setFromMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const positionMs = usePlaybackClock(state === 'playing', fromMs);
  // The same moment for the drawing, which moves every frame rather than
  // every render (INV-NOTES-136).
  const drawnPositionMs = useDrawnPosition(state === 'playing', fromMs);
  const anchor = useTakeAnchor();
  const levelRef = useRef(1);
  /** What is loaded, so the same take is not decoded twice. */
  const loadedFor = useRef<string | null>(null);
  const endsAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndsAt = useCallback(() => {
    if (endsAt.current != null) {
      clearTimeout(endsAt.current);
      endsAt.current = null;
    }
  }, []);

  const silence = useCallback(() => {
    clearEndsAt();
    NativeSynth?.clearBus(trackBus('take'));
  }, [clearEndsAt]);

  // A different note means a different take: what is loaded is no longer what
  // anyone is going to ask for.
  useEffect(() => {
    loadedFor.current = null;
    return () => {
      silence();
      NativeSynth?.unloadSample(TAKE_SLOT);
    };
  }, [resolveAudioUri, silence]);

  const play = useCallback(
    async (startAtMs = 0): Promise<void> => {
      if (state === 'loading' || state === 'playing') {
        return;
      }
      setState('loading');
      let resolved: string | null = null;
      try {
        // Minted now rather than at render: a backend file token is good for
        // about two minutes (INV-NOTES-014).
        resolved = await resolveAudioUri();
        if (resolved == null || NativeSynth == null) {
          console.warn('[useTakeVoice] no audio URL could be resolved');
          setState('error');
          return;
        }
        await NativeSynth.start();
        // Decoded once. A second press of the same take is a schedule and
        // nothing else, which is what makes it immediate.
        const takeMs =
          loadedFor.current === resolved && durationMs > 0
            ? durationMs
            : await NativeSynth.loadSample(TAKE_SLOT, resolved);
        loadedFor.current = resolved;
        setDurationMs(takeMs);

        const offsetMs = Math.min(Math.max(startAtMs, 0), Math.max(0, takeMs - 1));
        setFromMs(offsetMs);
        NativeSynth.setBusLevel(trackBus('take'), levelRef.current);
        // A moment we choose, on the clock everything else is choosing on.
        const beginsAtMs = audioNowMs() + SCHEDULE_LEAD_MS;
        NativeSynth.scheduleSamples([
          {
            bus: trackBus('take'),
            slot: TAKE_SLOT,
            fromMs: offsetMs,
            startMs: beginsAtMs,
            endMs: beginsAtMs + (takeMs - offsetMs)
          }
        ]);
        // The engine has no way to say a voice ended, and a transport that
        // waited for one would sit on pause over silence (INV-NOTES-085).
        clearEndsAt();
        endsAt.current = setTimeout(
          () => setState('stopped'),
          Math.max(0, takeMs - offsetMs) + SCHEDULE_LEAD_MS
        );
        anchor.mark(beginsAtMs - offsetMs);
        setState('playing');
      } catch (err) {
        console.warn('[useTakeVoice] playback failed for', resolved, err);
        setState('error');
        silence();
      }
    },
    [anchor, clearEndsAt, durationMs, resolveAudioUri, silence, state]
  );

  const stop = useCallback((): Promise<void> => {
    silence();
    setState('stopped');
    // Nothing to wait for: silencing a bus is a posted command, not a
    // teardown. The promise is here because the caller's contract has one.
    return Promise.resolve();
  }, [silence]);

  /**
   * Stop sounding without giving the moment back (INV-NOTES-152).
   *
   * Both clocks read from `fromMs` while nothing runs, so holding the head
   * where the take got to is a matter of saying that is where this run now
   * begins — which is also where the next press picks it up.
   *
   * From the anchor rather than the counter: the anchor is the engine's own
   * clock asked at this instant, and the counter is read to the second
   * (INV-NOTES-136). A pause half a second from the ear is a rewind.
   */
  const pause = useCallback((): Promise<number> => {
    const reached =
      state === 'playing'
        ? Math.min(anchor.reachedMs(), Math.max(0, durationMs))
        : fromMs;
    silence();
    setFromMs(reached);
    setState('stopped');
    return Promise.resolve(reached);
  }, [anchor, durationMs, fromMs, silence, state]);

  /**
   * How loud the take sits, set on its bus.
   *
   * Reaching what is already sounding, and on the same scale as every other
   * track: the take used to have a gain node of its own, which made balancing
   * a mix two mixers rather than one (INV-NOTES-133).
   */
  const setLevel = useCallback((level: number): void => {
    levelRef.current = Math.max(0, Math.min(1, level));
    NativeSynth?.setBusLevel(trackBus('take'), levelRef.current);
  }, []);

  return {
    state,
    positionMs,
    drawnPositionMs,
    elapsedMs: anchor.elapsedMs,
    durationMs,
    play,
    pause,
    stop,
    setLevel
  };
}
