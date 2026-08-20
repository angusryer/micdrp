/**
 * The record control, in the header beside the account control.
 *
 * It remounts on every navigation, which is fine: the session it drives lives
 * in `activeSession` rather than in this component, so a recording survives
 * being navigated away from. Survival and placement are separate concerns —
 * conflating them is what produced the first version, an overlay above the
 * navigator that survived navigation and landed under the status bar where it
 * could not be pressed at all (INV-DOG-014).
 *
 * The countdown appears only in the last stretch (INV-DOG-003 pairs with it):
 * a timer running the whole time invites watching the clock instead of talking.
 *
 * While a take holds the microphone the control is visibly unavailable rather
 * than hidden. Hiding it would read as a bug; disabled says the app is busy.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { subscribeToBusy } from '../app/activity';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { TICK_MS, readClipOrigin } from './config';
import { activeSession } from './activeSession';
import { enqueue, flushPending } from './upload';
import { IDLE_SESSION, type RecordingSession } from './types';
import { currentRoute, subscribeToRoute } from './route';
import { newClipId } from './id';
import { runningBundleId } from './origin';

const seconds = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function DogfoodControl(): React.ReactElement | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const session = activeSession();
  const [view, setView] = useState<RecordingSession>(IDLE_SESSION);

  const refresh = useCallback(() => setView(session.snapshot()), [session]);

  /** Finish and queue. Used by the stop control and by the cap alike. */
  const finish = useCallback(async () => {
    const clip = await session.stop();
    refresh();
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
  }, [session, refresh]);

  // Tick while recording, and send the clip the moment the cap is reached.
  useEffect(() => {
    if (view.state !== 'recording') {
      return undefined;
    }
    const timer = setInterval(() => {
      if (session.snapshot().remainingMs <= 0) {
        void finish();
        return;
      }
      refresh();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [view.state, session, refresh, finish]);

  // A take starting or ending changes whether the control is available.
  useEffect(() => subscribeToBusy(refresh), [refresh]);

  // Navigating mid-sentence is context, not an interruption (INV-DOG-002).
  useEffect(() => subscribeToRoute((route) => session.navigate(route)), [session]);

  // Anything left over from a previous session goes up on launch.
  useEffect(() => {
    void flushPending();
  }, []);

  const onPress = useCallback(async () => {
    if (view.state === 'idle') {
      await session.start(currentRoute() ?? 'unknown');
    } else if (view.state === 'recording') {
      session.pause();
    } else {
      session.resume(currentRoute() ?? 'unknown');
    }
    refresh();
  }, [view.state, session, refresh]);

  const idle = view.state === 'idle';
  const label = idle
    ? t('dogfood.record')
    : view.state === 'recording'
      ? t('dogfood.pause')
      : t('dogfood.resume');

  return (
    <View style={styles.row}>
      {!idle ? (
        <Text
          style={[
            styles.time,
            { color: view.isCountingDown ? colors.error : colors.gray300 }
          ]}>
          {seconds(view.isCountingDown ? view.remainingMs : view.elapsedMs)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !view.canRecord }}
        disabled={!view.canRecord}
        hitSlop={12}
        onPress={() => void onPress()}
        style={[
          styles.dot,
          {
            backgroundColor: view.canRecord ? colors.error : colors.gray100,
            opacity: view.canRecord ? 1 : 0.4
          },
          view.state === 'recording' ? styles.recording : null
        ]}
      />
      {!idle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dogfood.stop')}
          hitSlop={12}
          onPress={() => void finish()}
          style={[styles.stop, { borderColor: colors.gray300 }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Laid out by the header, which already accounts for the safe area. No
  // absolute positioning here — that is what put it under the status bar.
  row: { flexDirection: 'row', alignItems: 'center' },
  time: { fontVariant: ['tabular-nums'], fontSize: 13, marginRight: 8 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  recording: { borderRadius: 3 },
  stop: { width: 14, height: 14, borderWidth: 2, borderRadius: 2, marginLeft: 10 }
});
