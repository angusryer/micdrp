/**
 * TogglePill — one entry in the playback options' list of toggles.
 *
 * Extracted from PlaybackMixToggle once the readings joined the tracks in that
 * list (INV-NOTES-026). Two copies of the pill would have let the two drift,
 * and a reading drawn unlike a track reads as a different kind of question —
 * which is exactly what the segmented control under the graph was doing.
 *
 * A track stands alone, so it is a checkbox; a reading is one of two, so it is
 * a radio. That is the only difference between them, and it is told to the
 * screen reader rather than drawn.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme';

export interface TogglePillProps {
  label: string;
  /**
   * What a screen reader hears, when the drawn word is not enough on its own.
   * Two reading rows put "As sung" in the list twice, and which one it is
   * comes from the row it sits in — visible on screen, absent from the voice.
   */
  accessibilityLabel?: string;
  isOn: boolean;
  /**
   * Dimmed and refusing a press. A choice that would leave nothing sounding,
   * or that the take cannot answer, is greyed rather than hidden: a control
   * that vanishes reads as a bug, one that is greyed reads as a limit.
   */
  isDisabled?: boolean;
  /** 'checkbox' for a track on its own, 'radio' for one of two readings. */
  role?: 'checkbox' | 'radio';
  testID?: string;
  onPress: () => void;
}

export function TogglePill({
  label,
  accessibilityLabel,
  isOn,
  isDisabled = false,
  role = 'checkbox',
  testID,
  onPress
}: TogglePillProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        role === 'radio'
          ? { selected: isOn, disabled: isDisabled }
          : { checked: isOn, disabled: isDisabled }
      }
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.pill,
        isDisabled && styles.dimmed,
        {
          backgroundColor: isOn ? colors.primary500 : colors.neutral100,
          borderColor: isOn ? colors.primary500 : colors.neutral500
        }
      ]}
    >
      <Text
        style={[styles.label, { color: isOn ? colors.white : colors.gray300 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default TogglePill;

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth
  },
  dimmed: { opacity: 0.45 },
  label: { fontSize: 12, fontWeight: '600' }
});
