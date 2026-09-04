/**
 * The quiet word in a take's details header that hands the recording over.
 *
 * A word rather than a button, in the muted colour beside the accented
 * close. Sharing is occasional and reversible, and the sheet it sits in is
 * opened to tune a reading — a full-width filled button was the loudest
 * thing on it for an action taken once per take at most (VIEW-DOG-003).
 *
 * Being small costs it the room to explain itself, so nothing leaves the
 * device on a tap: the confirmation says what travels, and that is where
 * the explanation lives now.
 */
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import {
  confirmPending,
  confirmShare,
  confirmWithdraw,
  reportShareProblem
} from './shareConfirm';
import type { TakeShare } from './useTakeShare';

export interface ShareTakeControlProps {
  share: TakeShare;
  /** False when the take has no recording behind it, anywhere. */
  hasAudio: boolean;
}

/** What the control says, from where the share has got to. */
const WORD: Record<TakeShare['state'], string> = {
  none: 'dogfood.share.give',
  pending: 'dogfood.share.sending',
  shared: 'dogfood.share.given'
};

export function ShareTakeControl({
  share,
  hasAudio
}: ShareTakeControlProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isShared = share.state === 'shared';
  // Dimmed rather than hidden. Hidden reads as a bug; dimmed says there is
  // nothing here to send. A take already shared stays tappable even if its
  // audio has since gone from this device — withdrawing needs no file.
  const disabled = (!hasAudio && !isShared) || share.isWorking;

  const onPress = useCallback(async () => {
    if (isShared) {
      if (await confirmWithdraw(t)) {
        await share.withdraw();
      }
      return;
    }
    // Still queued. Saying "sending" and doing nothing when tapped would
    // leave a stuck queue looking exactly like a working one.
    if (share.state === 'pending') {
      if (await confirmPending(t, share.waitingBecause)) {
        await share.withdraw();
      }
      return;
    }
    if (!(await confirmShare(t))) {
      return;
    }
    await share.share();
  }, [isShared, share, t]);

  // Raised rather than printed: there is no room for a line of explanation
  // beside one word, and a share that did not happen has to say so. In an
  // effect, not in the render — an alert is not something a render does.
  const { problem, clearProblem } = share;
  useEffect(() => {
    if (problem != null) {
      reportShareProblem(t, problem);
      clearProblem();
    }
  }, [problem, clearProblem, t]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(WORD[share.state])}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => void onPress()}
      style={styles.target}
    >
      <Text
        style={[
          styles.word,
          { color: colors.gray500, opacity: disabled ? 0.4 : 1 }
        ]}
      >
        {t(WORD[share.state])}
      </Text>
    </Pressable>
  );
}

export default ShareTakeControl;

const styles = StyleSheet.create({
  /**
   * A real 44pt target rather than a small word plus hitSlop. hitSlop
   * reserves no layout space, so a neighbour can claim the same points and
   * win — which is what put every tap of the record control into settings
   * (INV-DOG-014).
   */
  target: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  word: { fontSize: 15, fontWeight: '600' }
});
