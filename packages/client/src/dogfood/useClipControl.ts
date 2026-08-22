/**
 * Everything the record control does, with nothing about how it looks.
 *
 * The control itself is a mark, a countdown and a touch target; this is the
 * session behind them — the tick, the two ways a clip can end, and the queue
 * it goes to. They were one file until the alert on running out of time
 * pushed it past what fits in a single read, and they part cleanly because
 * the state lives in `activeSession` rather than in the component: this hook
 * only mirrors it into React and drives it.
 */
import { useCallback, useEffect, useState } from 'react';

import { subscribeToBusy } from '../app/activity';
import { activeSession } from './activeSession';
import { TICK_MS, readClipOrigin } from './config';
import { newClipId } from './id';
import { runningBundleId } from './origin';
import { announceOutOfTime } from './outOfTime';
import { currentRoute, subscribeToRoute } from './route';
import { IDLE_SESSION, type RecordingSession } from './types';
import { enqueue, flushPending } from './upload';

/** Just enough of i18n's `t` for the out-of-time alert. */
type Translate = (key: string) => string;

export function useClipControl(t: Translate): {
  view: RecordingSession;
  onPress: () => Promise<void>;
} {
  const session = activeSession();
  const [view, setView] = useState<RecordingSession>(IDLE_SESSION);

  const refresh = useCallback(() => setView(session.snapshot()), [session]);

  /**
   * Finish and queue. Used by the tap on the square and by the cap alike —
   * `ranOut` says which, and is the only thing the two endings differ by.
   * It is announced before the clip is examined, because running out of time
   * is worth saying whether or not there turned out to be a file.
   */
  const finish = useCallback(
    async (ranOut = false) => {
      const clip = await session.stop().catch((error: unknown) => {
        console.warn('[dogfood] stop failed', error);
        return null;
      });
      refresh();
      if (ranOut) {
        announceOutOfTime(t);
      }
      if (!clip) {
        return;
      }
      const origin = readClipOrigin();
      enqueue({
        id: newClipId(),
        audioPath: clip.audioPath,
        durationMs: clip.durationMs,
        screenTrail: clip.trail,
        appVersion: origin.appVersion,
        buildNumber: origin.buildNumber,
        bundleId: runningBundleId(),
        recordedAtMs: Date.now()
      });
      void flushPending();
    },
    [session, refresh, t]
  );

  // Tick while recording, and send the clip the moment the cap is reached.
  useEffect(() => {
    if (view.state !== 'recording') {
      return undefined;
    }
    const timer = setInterval(() => {
      if (session.snapshot().remainingMs <= 0) {
        void finish(true);
        return;
      }
      refresh();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [view.state, session, refresh, finish]);

  // A take starting or ending changes whether the control is available.
  useEffect(() => subscribeToBusy(refresh), [refresh]);

  // Navigating mid-sentence is context, not an interruption (INV-DOG-002).
  useEffect(
    () => subscribeToRoute((route) => session.navigate(route)),
    [session]
  );

  // Anything left over from a previous session goes up on launch.
  useEffect(() => {
    void flushPending();
  }, []);

  // One control, two shapes. Round starts the clip; the square it becomes
  // ends it and sends it, which is the only other thing a remark can need.
  const onPress = useCallback(async () => {
    if (view.state !== 'idle') {
      await finish();
      return;
    }
    await session.start(currentRoute() ?? 'unknown');
    refresh();
  }, [view.state, session, refresh, finish]);

  return { view, onPress };
}
