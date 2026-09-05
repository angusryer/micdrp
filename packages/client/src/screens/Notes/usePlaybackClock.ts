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
import {
  drawnAt,
  firstSample,
  fold,
  type HeadReading
} from './headSample';

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
   * What the JS thread has read, and which reading it is.
   *
   * One value, written once: as two they tore, and a frame landing between
   * the writes drew the new moment against the old stamp (INV-TPORT-021).
   */
  const reading = useSharedValue<HeadReading>({ atMs: fromMs, seq: 0 });
  /**
   * What the UI thread is drawing from.
   *
   * Owned entirely over there, because folding a reading in needs the
   * position as it is at that frame — a number the JS thread does not have
   * and would be stale by the time it did (INV-TPORT-029).
   */
  const sample = useSharedValue(firstSample(fromMs));

  useEffect(() => {
    positionMs.value = fromMs;
    reading.value = { atMs: fromMs, seq: 0 };
    sample.value = firstSample(fromMs);
    if (!running) {
      return;
    }
    const startedAt = audioNowMs();
    let seq = 0;
    const read = () => {
      // The engine's own position where there is an engine to ask
      // (INV-TPORT-010, INV-TPORT-022). The computed one is the fallback
      // for a binary that cannot report a run at all (INV-TPORT-014).
      const run = engineRun();
      seq += 1;
      reading.value = {
        atMs:
          run != null
            ? run.positionMs
            : fromMs + Math.max(0, audioNowMs() - startedAt),
        seq
      };
    };
    read();
    const id = setInterval(read, SAMPLE_MS);
    return () => clearInterval(id);
  }, [running, fromMs, positionMs, reading, sample]);

  // `timestamp`, not `timeSinceFirstFrame` (INV-TPORT-031). The latter is
  // measured from when this callback was registered, and `useFrameCallback`
  // re-registers whenever the callback's identity changes — which, for a
  // worklet written inline, is every render. It restarted several times a
  // second while the moment measured against it did not.
  useFrameCallback(({ timestamp }) => {
    'worklet';
    if (!running) {
      return;
    }
    const latest = reading.value;
    if (latest.seq !== sample.value.seq) {
      // Folded in against where the head is right now, so this frame draws
      // exactly where the last one did and the gap closes over the interval
      // that follows (INV-TPORT-029, INV-TPORT-030).
      sample.value = fold(latest, positionMs.value, timestamp);
    }
    positionMs.value = drawnAt(sample.value, timestamp);
  }, true);

  return positionMs;
}
