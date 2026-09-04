/**
 * The row at the foot of a take's details that hands the recording over.
 *
 * It says what travels before it is tapped, not after. This is the one
 * control in the app that sends a recording of the maintainer's singing
 * anywhere, and a control like that explains itself first.
 *
 * One row with two states, not two controls: the thing that shared it is
 * the thing that takes it back, because somebody who has second thoughts
 * about a recording of their own voice should not have to go and find a
 * different screen (INV-DOG-035).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import type { TakeShare } from './useTakeShare';

export interface ShareTakeRowProps {
  share: TakeShare;
  /** False when the take has no recording behind it, anywhere. */
  hasAudio: boolean;
}

export function ShareTakeRow({
  share,
  hasAudio
}: ShareTakeRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isShared = share.state === 'shared';
  // Unavailable rather than hidden. Hidden reads as a bug; the reason —
  // there is nothing to send — is the useful thing to say.
  const disabled = (!hasAudio && !isShared) || share.isWorking;
  const label = isShared ? t('dogfood.share.withdraw') : t('dogfood.share.give');

  return (
    <View style={styles.container}>
      <Text style={[styles.what, { color: colors.gray500 }]}>
        {isShared
          ? t('dogfood.share.given', {
              when:
                share.sharedAtMs == null
                  ? ''
                  : new Date(share.sharedAtMs).toLocaleDateString()
            })
          : t('dogfood.share.what')}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => void (isShared ? share.withdraw() : share.share())}
        style={[
          styles.button,
          {
            backgroundColor: disabled
              ? colors.neutral500
              : isShared
                ? colors.neutral500
                : colors.primary500
          }
        ]}
      >
        {share.isWorking ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text
            style={[
              styles.buttonText,
              { color: isShared ? colors.typography : colors.white }
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>

      {!hasAudio && !isShared ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {t('dogfood.share.noRecording')}
        </Text>
      ) : null}
      {share.state === 'pending' ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {share.waitingBecause == null
            ? t('dogfood.share.waiting')
            : `${t('dogfood.share.waiting')} — ${share.waitingBecause}`}
        </Text>
      ) : null}
      {share.problem != null ? (
        <Text style={[styles.hint, { color: colors.error }]}>{share.problem}</Text>
      ) : null}
    </View>
  );
}

export default ShareTakeRow;

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 18 },
  what: { fontSize: 13, lineHeight: 18 },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, textAlign: 'center' }
});
