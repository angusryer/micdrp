/**
 * usePlaybackClock — how far into a running take we are, in milliseconds.
 *
 * The engine's clock, not the wall clock. This was `Date.now()` on a timer,
 * justified by a BufferSourceNode reporting no position — which stopped being
 * true when the take became a voice on the engine (INV-NOTES-133). What was
 * left was a third clock approximating the one the audio actually runs on,
 * drifting from it over a long take (INV-NOTES-136).
 *
 * Two readings of the same moment, at two rates. The number shown as text is
 * read to the second and costs a render, so it is sampled a few times a
 * second. The drawn playhead is a position on a graph and has to move every
 * frame, so it rides a shared value the UI thread advances between samples —
 * rendering the graph sixty times a second to move one line would be the
 * expensive part of the picture redone for the cheapest part of it.
 *
 * Owned by its own module so `useTakeVoice` stays the audio machine and stays
 * inside the file budget.
 */
import { useEffect, useState } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';

import { audioNowMs } from '../../audio/audioClock';
import { engineRun } from '../../audio/engineTransport';
import { drawnAt, readingAt } from './headSample';

/**
 * How often the engine's clock is read, in ms.
 *
 * Often enough that the interpolation between samples never has far to be
 * pulled back, rare enough that the render it costs is not a per-frame cost.
 */
const SAMPLE_MS = 200;

/**
 * How often the counter shown as text is refreshed, in ms.
 *
 * Slower on purpose: it is read to the second, and a re-render is a re-render
 * whatever changed.
 */
const READOUT_MS = 500;

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
    // Where the engine was when this run began, so the reading below is the
    // engine's own elapsed time rather than time since a render.
    const startedAt = audioNowMs();
    const id = setInterval(
      () => setElapsedMs(fromMs + Math.max(0, audioNowMs() - startedAt)),
      READOUT_MS
    );
    return () => clearInterval(id);
  }, [running, fromMs]);

  return elapsedMs;
}

/**
 * The same moment, as a value the UI thread can read every frame.
 *
 * Sampled from the engine a few times a second and advanced by frame time in
 * between, so it moves smoothly and is pulled back to the truth before it can
 * drift (INV-NOTES-136). Nothing here re-renders: a shared value written from
 * either thread is read by the drawing without React involved.
 */
export function useDrawnPosition(
  running: boolean,
  fromMs = 0
): SharedValue<number> {
  const positionMs = useSharedValue(fromMs);
  /**
   * The last reading, and the frame that dates it — one value.
   *
   * They were two, written one after the other from the JS thread, and a
   * frame landing between the writes drew the new moment measured from
   * the old stamp: a jump forward of the whole interval and a snap back
   * next frame (INV-TPORT-021).
   */
  const sample = useSharedValue(readingAt(fromMs));

  useEffect(() => {
    positionMs.value = fromMs;
    sample.value = readingAt(fromMs);
    if (!running) {
      return;
    }
    const startedAt = audioNowMs();
    const read = () => {
      // The engine's own position where there is an engine to ask
      // (INV-TPORT-010, INV-TPORT-022). The computed one is the fallback
      // for a binary older than this bundle, which is every binary until
      // the run state is built (INV-TPORT-014).
      const run = engineRun();
      sample.value = readingAt(
        run != null ? run.positionMs : fromMs + Math.max(0, audioNowMs() - startedAt)
      );
    };
    read();
    const id = setInterval(read, SAMPLE_MS);
    return () => clearInterval(id);
  }, [running, fromMs, positionMs, sample]);

  useFrameCallback(({ timeSinceFirstFrame }) => {
    'worklet';
    if (!running) {
      return;
    }
    const held = sample.value;
    if (held.frameMs < 0) {
      // Dated by the UI thread's own clock, which is the only clock the
      // interpolation may use.
      sample.value = { atMs: held.atMs, frameMs: timeSinceFirstFrame };
    }
    positionMs.value = drawnAt(held, timeSinceFirstFrame);
  }, true);

  return positionMs;
}
