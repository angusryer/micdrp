/**
 * The take, as a thing the transport can command (INV-TPORT-001).
 *
 * Three operations and no state: resolve and schedule from a moment,
 * silence, and say where the run has reached. Everything about *what is
 * happening* moved up into the transport, which is the whole point —
 * this file used to hold the state machine as well, and the two answers
 * that came of that are most of the history in INV-TPORT.
 *
 * The recording is decoded once into a slot on the native engine and
 * then scheduled by the same call, on the same clock, at the same bus
 * levels as every synthesized voice (INV-NOTES-133). There is no second
 * graph to line up with.
 */
import { useCallback, useEffect, useRef } from 'react';

import NativeSynth from '../../specs/NativeSynth';
import { SCHEDULE_LEAD_MS, audioNowMs } from '../../audio/audioClock';
import type { TransportEngine } from '../../audio/transportStore';
import { useTakeAnchor } from './useTakeAnchor';
import { trackBus } from './trackRegistry';
import { TAKE_SLOT } from './sampleSlots';

export interface TakeEngine extends TransportEngine {
  /** How long the take runs, once it has been decoded at least once. */
  durationMs: () => number;
  /** Milliseconds since the audio started, for lining a voice up with it. */
  elapsedMs: () => number;
  setLevel: (level: number) => void;
}

export function useTakeEngine(
  resolveAudioUri: () => Promise<string | null>
): TakeEngine {
  const anchor = useTakeAnchor();
  const levelRef = useRef(1);
  const durationRef = useRef(0);
  /** What is loaded, so the same take is not decoded twice. */
  const loadedFor = useRef<string | null>(null);

  // A different take means a different recording: what is loaded is no
  // longer what anyone is going to ask for.
  useEffect(() => {
    loadedFor.current = null;
    return () => {
      // Only this take's bus. Leaving a screen is not stopping, and must
      // not silence what another screen started (INV-NOTES-205).
      NativeSynth?.clearBus(trackBus('take'));
      NativeSynth?.unloadSample(TAKE_SLOT);
    };
  }, [resolveAudioUri]);

  /** The native work, once the audio has an address and an engine exists. */
  const schedule = useCallback(
    async (
      synth: NonNullable<typeof NativeSynth>,
      resolved: string,
      fromMs: number
    ): Promise<number> => {
      await synth.start();
      // Decoded once. A second press of the same take is a schedule and
      // nothing else, which is what makes it immediate.
      const takeMs =
        loadedFor.current === resolved && durationRef.current > 0
          ? durationRef.current
          : await synth.loadSample(TAKE_SLOT, resolved);
      loadedFor.current = resolved;
      durationRef.current = takeMs;

      const offsetMs = Math.min(Math.max(fromMs, 0), Math.max(0, takeMs - 1));
      synth.setBusLevel(trackBus('take'), levelRef.current);
      // A moment we choose, on the clock everything else is choosing on.
      const beginsAtMs = audioNowMs() + SCHEDULE_LEAD_MS;
      synth.scheduleSamples([
        {
          bus: trackBus('take'),
          slot: TAKE_SLOT,
          fromMs: offsetMs,
          startMs: beginsAtMs,
          endMs: beginsAtMs + (takeMs - offsetMs)
        }
      ]);
      anchor.mark(beginsAtMs - offsetMs);
      return takeMs;
    },
    [anchor]
  );

  const start = useCallback(
    async (fromMs: number): Promise<number> => {
      // Minted now rather than at render: a backend file token is good
      // for about two minutes (INV-NOTES-014).
      const resolved = await resolveAudioUri();
      if (resolved == null || NativeSynth == null) {
        // Thrown, not swallowed. A command the engine will not take must
        // never read as a control that did nothing (INV-TPORT-006).
        throw new Error('no audio could be resolved for this take');
      }
      try {
        return await schedule(NativeSynth, resolved, fromMs);
      } catch (error) {
        // Said as well as thrown. The transport carries the reason to the
        // surface; this puts the cause and the address it failed on in
        // the log, which is what a device can be asked for.
        console.warn('[takeEngine] playback failed for', resolved, error);
        throw error;
      }
    },
    [schedule, resolveAudioUri]
  );

  const silence = useCallback(() => {
    // The whole engine. Silence must not be contingent on bookkeeping
    // being right about which bus a voice went to (INV-TPORT-005).
    NativeSynth?.clearAll();
  }, []);

  const setLevel = useCallback((level: number): void => {
    levelRef.current = Math.max(0, Math.min(1, level));
    NativeSynth?.setBusLevel(trackBus('take'), levelRef.current);
  }, []);

  return {
    start,
    silence,
    reachedMs: anchor.reachedMs,
    durationMs: () => durationRef.current,
    elapsedMs: anchor.elapsedMs,
    setLevel
  };
}
