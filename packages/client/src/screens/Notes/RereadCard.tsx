/**
 * Reading a take again with whatever the engine can do now.
 *
 * Always offered, and said differently where the app itself has moved on.
 *
 * It was offered only on takes an older engine had read, on the reasoning that
 * a control which changes nothing is worse than no control. That reasoning was
 * incomplete: the reading also depends on settings a person can change
 * (INV-ACCOUNT-014), so a take read by this engine with different knobs is
 * stale in the way that actually matters, and the version number cannot know
 * it. Hiding the control there left no way to apply a knob to a take already
 * recorded (INV-NOTES-116).
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
  /**
   * What reading it again would do (INV-NOTES-262): find the notes the
   * way a newer listener hears, read with thresholds since changed, or
   * give back exactly what the take already has (INV-NOTES-261).
   */
  change: 'stale' | 'retuned' | 'unchanged';
  /**
   * Re-read it. Resolves with why it failed, or null where it worked
   * (INV-NOTES-184).
   */
  onReread: () => Promise<string | null>;
  /**
   * Whether the reading this take had before can be put back
   * (INV-NOTES-215).
   *
   * Every threshold the reader uses is set once for the app rather than per
   * take, so a tuning arrived at against a recent take is what an old one
   * gets read with — and whether that is better is a judgement only the
   * person who sang it can make.
   */
  canUndo?: boolean;
  onUndo?: () => Promise<void>;
}

export function RereadCard({
  change,
  onReread,
  canUndo = false,
  onUndo
}: RereadCardProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [isReading, setIsReading] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = () => {
    setFailed(false);
    setIsReading(true);
    void onReread()
      .then((why) => setFailed(why != null))
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
        {change === 'stale'
          ? 'This take was read by an older version of the listener. Reading it again will find the notes and drums the way the app hears now.'
          : change === 'retuned'
            ? 'The listener settings have changed since this take was read. Reading it again will apply them.'
            : 'Nothing has changed since this take was read. Reading it again would give back exactly what it has now.'}
      </Text>
      <Text style={[styles.warning, { color: colors.error }]}>
        The notes, chords and timing will all be replaced. Corrections you made
        are kept and re-applied, but any that belonged to a note the app no
        longer hears will be lost.
      </Text>
      {canUndo ? (
        <Text style={[styles.body, { color: colors.gray300 }]}>
          The reading this take had before is kept, so you can put it back if
          you prefer it.
        </Text>
      ) : null}
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
            {change === 'unchanged' ? 'Read it again anyway' : 'Read it again'}
          </Text>
        )}
      </Pressable>
      {canUndo && onUndo != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Put the previous reading back"
          testID="undo-reread"
          onPress={() => void onUndo()}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: colors.gray300,
              backgroundColor: pressed ? colors.neutral300 : 'transparent'
            }
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.gray500 }]}>
            Put the previous reading back
          </Text>
        </Pressable>
      ) : null}
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
