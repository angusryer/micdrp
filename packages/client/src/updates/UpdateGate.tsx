/**
 * The one screen this domain owns, and the policy around when it may appear.
 *
 * The check runs on mount and on every return to the foreground, so a tester
 * who leaves the app open for days still sees a fix. What it finds is
 * downloaded silently; the modal only ever appears once there is a verified
 * bundle sitting ready — including one staged by an earlier session and never
 * answered (INV-UPD-023).
 *
 * It is drawn in the app's own tree rather than presented (INV-UPD-025). On
 * iOS a modal is a presented view controller, and a second presentation while
 * a sheet is already up is dropped without an error — and the note screen,
 * where a person waiting on a fix actually is, keeps sheets up. A notice that
 * has to win a presentation contest to be seen is a notice that can be lost.
 *
 * Two things hold it back, and only two:
 *   - the singer already said later to this bundle (INV-UPD-007);
 *   - nothing is staged.
 *
 * A take no longer holds it back. It takes no input and covers nothing, so it
 * costs no take; what waits for the take to end is the restart, which is the
 * thing INV-UPD-004 was ever really about.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
import { applyUpdate, deferUpdate, isDeferred } from './apply';
import { checkForUpdate } from './check';
import { stagedBundle } from './bundle';
import { downloadBundle } from './download';
import { isBusy, subscribeToBusy } from '../app/activity';
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
      // A bundle already downloaded and waiting is offered before anything is
      // asked of the server (INV-UPD-023). The prompt used to be raised only
      // by a download completing, so one staged and left unanswered was never
      // mentioned again — and nothing else could raise it, since the check
      // reports a staged bundle as the one running and the server rightly
      // answers that there is nothing newer.
      const waiting = stagedBundle();
      if (waiting != null && !isDeferred(waiting)) {
        setPending({ bundleId: waiting });
        return;
      }
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

  if (pending === null) {
    return null;
  }

  return (
    // Over everything and blocking nothing: what is behind it stays live,
    // which is what lets it be shown during a take at all.
    <View style={styles.layer} pointerEvents="box-none">
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
          {/* Offered only when nothing is being sung: the restart is the part
              that costs a take (INV-UPD-004). */}
          {!busy ? (
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
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pinned near the top, clear of the sheets that live at the bottom of the
  // one screen this is most often shown over.
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 64
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    minWidth: 260,
    // Enough to read as sitting over the page rather than in it.
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  message: { fontSize: 16, marginBottom: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { paddingHorizontal: 12, paddingVertical: 8 }
});
