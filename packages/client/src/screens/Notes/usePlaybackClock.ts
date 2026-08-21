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

/** Re-read the clock twice a second — a counter shown to the second needs no more. */
const TICK_MS = 500;

/**
 * Elapsed milliseconds since `running` turned true, 0 whenever it is false.
 * Restarts from zero each time it turns true, which is each fresh press of play.
 */
export function usePlaybackClock(running: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (!running) {
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      TICK_MS
    );
    return () => clearInterval(id);
  }, [running]);

  return elapsedMs;
}

/**
 * The instant the audio itself started, and how far past it we are now.
 *
 * Read at the moment something else has to be lined up with a take already
 * running — the chord backdrop, which is scheduled a render and an audio
 * context after the take began (INV-NOTES-020). A ref, not state: the reader
 * wants the value as it is when it asks, and marking the anchor must not
 * re-render the transport that just started.
 */
export interface TakeAnchor {
  /** Record that the audio has just started. */
  mark: () => void;
  /** Milliseconds since the last mark; 0 before the first one. */
  elapsedMs: () => number;
}

export function useTakeAnchor(): TakeAnchor {
  const startedAt = useRef<number | null>(null);
  return useMemo(
    () => ({
      mark: () => {
        startedAt.current = Date.now();
      },
      elapsedMs: () =>
        startedAt.current === null
          ? 0
          : Math.max(0, Date.now() - startedAt.current)
    }),
    []
  );
}
