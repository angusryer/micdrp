/**
 * Back to the beginning, directly above the play control (INV-NOTES-227).
 *
 * Beside play rather than behind a gesture: a wrong note is judged by hearing
 * it again, and finding the top of the take was costing the whole take
 * (INT-NOTES-020).
 *
 * Ringed, faintly: it is a control rather than a switch like the rows above
 * it, and the ring says so without another glyph or a word in a column 38
 * points wide. Lighter than the play control below it, which is the one being
 * aimed at.
 *
 * Its own component for the same reason PlaybackButton is one — a control
 * that can be pressed on its own can be tested on its own.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface RailRewindProps {
  onPress: () => void;
}

export function RailRewind({ onPress }: RailRewindProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('notes.rewind')}
      testID="rail-rewind"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.ring,
        { borderColor: colors.neutral500, opacity: pressed ? 0.5 : 1 }
      ]}
    >
      <Icon name="rewind" size={16} color={colors.gray300} />
    </Pressable>
  );
}

export default RailRewind;

/** Comfortably inside the rail, and clear of the control below it. */
export const RAIL_REWIND_SIZE = 30;
const SIZE = RAIL_REWIND_SIZE;

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
