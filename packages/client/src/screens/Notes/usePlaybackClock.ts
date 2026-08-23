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
