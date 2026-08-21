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
import { useEffect, useState } from 'react';

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
