/**
 * Back to the beginning, directly above the play control (INV-NOTES-227).
 *
 * Beside play rather than behind a gesture: a wrong note is judged by hearing
 * it again, and finding the top of the take was costing the whole take
 * (INT-NOTES-020).
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
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name="rewind" size={18} color={colors.gray300} />
    </Pressable>
  );
}

export default RailRewind;

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 6, width: '100%' }
});
