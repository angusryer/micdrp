/**
 * Reading a take again with whatever the engine can do now.
 *
 * Offered only where it would change something. A take already read by the
 * current engine has nothing to gain, and a control that does nothing is worse
 * than no control — it invites a person to try it and learn that the app
 * cannot tell the difference (INV-NOTES-116).
 *
 * The warning is stated before the button rather than in a dialog after it.
 * What it costs is real: the reading is replaced outright, and an edit whose
 * note is no longer there finds nothing to apply to. That is worth reading
 * before pressing, not after.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

export interface RereadCardProps {
  /** False where this take was already read by the current engine. */
  isStale: boolean;
  /** Re-read it. Resolves false where there was nothing to read. */
  onReread: () => Promise<boolean>;
}

export function RereadCard({
  isStale,
  onReread
}: RereadCardProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [isReading, setIsReading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isStale) {
    return null;
  }

  const run = () => {
    setFailed(false);
    setIsReading(true);
    void onReread()
      .then((ok) => setFailed(!ok))
      .finally(() => setIsReading(false));
  };

  return (
    <View
      testID="reread-card"
      style={[
        styles.card,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
    >
      <Text style={[styles.title, { color: colors.typography }]}>
        Read this take again
      </Text>
      <Text style={[styles.body, { color: colors.gray300 }]}>
        This take was read by an older version of the listener. Reading it
        again will find the notes and drums the way the app hears now.
      </Text>
      <Text style={[styles.warning, { color: colors.error }]}>
        The notes, chords and timing will all be replaced. Corrections you made
        are kept and re-applied, but any that belonged to a note the app no
        longer hears will be lost.
      </Text>
      {failed ? (
        <Text style={[styles.warning, { color: colors.error }]}>
          The recording could not be opened, so nothing was changed.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Read this take again"
        disabled={isReading}
        onPress={run}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: colors.primary500,
            backgroundColor: pressed ? colors.neutral300 : 'transparent',
            opacity: isReading ? 0.6 : 1
          }
        ]}
      >
        {isReading ? (
          <ActivityIndicator color={colors.primary500} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primary500 }]}>
            Read it again
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default RereadCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 18
  },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
  warning: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  button: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 4
  },
  buttonText: { fontSize: 14, fontWeight: '600' }
});
