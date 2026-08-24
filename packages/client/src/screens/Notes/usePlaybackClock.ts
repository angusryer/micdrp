/**
 * usePlaybackClock — how far into a running take we are, in milliseconds.
 *
 * A wall clock, not the audio clock. The playback surface we type in
 * `audioApi.ts` is deliberately the slice we use, and a BufferSourceNode
 * reports no position through it; asking for one would widen the mocked
 * surface for a counter a singer reads to the second. A take is capped at two
 * minutes, so wall-clock drift against the audio clock is far below what that
 * counter can show.
 *
 * Owned by its own module so `usePlayback` stays the audio machine and stays
 * inside the file budget.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { SCHEDULE_LEAD_MS, audioNowMs } from '../../audio/audioClock';

/** Re-read the clock twice a second — a counter shown to the second needs no more. */
const TICK_MS = 500;

/**
 * Milliseconds into the take, 0 whenever nothing is running.
 *
 * `fromMs` is where this run of playback began. A take resumed part-way
 * through counts from there, not from zero — the counter names a moment in
 * the take, and after a rewind that moment is not the start (INV-NOTES-069).
 */
export function usePlaybackClock(running: boolean, fromMs = 0): number {
  const [elapsedMs, setElapsedMs] = useState(fromMs);

  useEffect(() => {
    setElapsedMs(fromMs);
    if (!running) {
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(
      () => setElapsedMs(fromMs + (Date.now() - startedAt)),
      TICK_MS
    );
    return () => clearInterval(id);
  }, [running, fromMs]);

  return elapsedMs;
}

/**
 * The instant the audio itself started, and where the take will be when
 * something scheduled now actually sounds.
 *
 * On the audio device's clock, not the wall clock. The synth schedules on the
 * engine's sample clock; a take anchored to `Date.now()` was being lined up
 * against a different clock entirely, and two clocks that are not the same
 * clock drift rather than differing by a constant (INV-NOTES-126).
 *
 * The lead is included on purpose. A voice scheduled now does not sound now —
 * it sounds a lead later, by which time the take has moved on — so the offset
 * a voice is given has to be where the take WILL be, not where it is.
 *
 * A ref, not state: the reader wants the value as it is when it asks, and
 * marking the anchor must not re-render the transport that just started.
 */
export interface TakeAnchor {
  /**
   * Record when the audio starts, on the audio clock.
   *
   * Given a moment, that moment; given none, now. A caller that scheduled the
   * take to begin at a known time in the future says so, and the anchor is
   * exact rather than an estimate taken beside the call (INV-NOTES-126).
   */
  mark: (atMs?: number) => void;
  /**
   * Where the take will be when something scheduled now actually sounds.
   *
   * 0 before the first mark. Includes the scheduling lead, because a voice
   * scheduled now sounds a lead later and the take will have moved on.
   */
  elapsedMs: () => number;
}

export function useTakeAnchor(): TakeAnchor {
  const startedAt = useRef<number | null>(null);
  return useMemo(
    () => ({
      mark: (atMs = audioNowMs()) => {
        startedAt.current = atMs;
      },
      elapsedMs: () =>
        startedAt.current === null
          ? 0
          : Math.max(0, audioNowMs() + SCHEDULE_LEAD_MS - startedAt.current)
    }),
    []
  );
}
