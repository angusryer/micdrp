/**
 * The one screen this domain owns, and the policy around when it may appear.
 *
 * The check runs on mount and on every return to the foreground, so a tester
 * who leaves the app open for days still sees a fix. What it finds is
 * downloaded silently; the modal only ever appears once there is a verified
 * bundle sitting ready.
 *
 * Three things can hold it back, and all three matter:
 *   - a capture or practice session is running (INV-UPD-004) — a modal over a
 *     live take costs the take, so the prompt waits for the take to end rather
 *     than being dropped;
 *   - the singer already said later to this bundle (INV-UPD-007);
 *   - nothing is staged.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
import { applyUpdate, deferUpdate, isDeferred } from './apply';
import { checkForUpdate } from './check';
import { downloadBundle } from './download';
import { isBusy, subscribeToBusy } from './busy';
import { rollBack } from './rollback';
import type { PendingBundle } from './types';

export default function UpdateGate(): React.ReactElement | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingBundle | null>(null);
  const [busy, setBusy] = useState(isBusy);
  const checking = useRef(false);

  const check = useCallback(async () => {
    // One check at a time. Foregrounding twice in quick succession must not
    // start two downloads of the same bundle.
    if (checking.current) {
      return;
    }
    checking.current = true;
    try {
      const result = await checkForUpdate();
      if (result.decision === 'rollback') {
        await rollBack(result);
        return;
      }
      const staged = await downloadBundle(result);
      if (staged && !isDeferred(staged.bundleId)) {
        setPending(staged);
      }
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  // Re-read busy on every transition, so a prompt held back during a take is
  // presented the moment the take ends (ACC-UPD-016).
  useEffect(() => subscribeToBusy(() => setBusy(isBusy())), []);

  const onLater = useCallback(() => {
    if (pending) {
      deferUpdate(pending.bundleId);
    }
    setPending(null);
  }, [pending]);

  const visible = pending !== null && !busy;
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onLater}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: colors.neutral50 }]}>
          <Text style={[styles.message, { color: colors.typography }]}>
            {t('updates.ready')}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              style={styles.action}>
              <Text style={{ color: colors.gray300 }}>{t('updates.later')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void applyUpdate();
              }}
              style={styles.action}>
              <Text style={{ color: colors.primary500 }}>
                {t('updates.restartNow')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  },
  card: { borderRadius: 12, margin: 32, padding: 20, minWidth: 260 },
  message: { fontSize: 16, marginBottom: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { paddingHorizontal: 12, paddingVertical: 8 }
});
