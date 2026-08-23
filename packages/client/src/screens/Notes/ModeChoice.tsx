/**
 * A two-way choice — as sung, or as written down — as a row in the playback
 * options' list of toggles (INV-NOTES-026).
 *
 * Shared by HearItAs and SeeItAs. The same distinction is offered twice, once
 * for what is heard and once for what is drawn, and two copies of the control
 * would let the two drift into looking like different questions. Which is why
 * the row is named: among the track pills, two identical pairs of As sung / As
 * written are only tellable apart by what they say they are for.
 *
 * It was a segmented control of its own beneath the graph. Same choice, but
 * drawn unlike everything else that decides what a press does, and in another
 * place — so setting up a listen meant a control in the sheet and a control
 * down the page.
 *
 * A choice the take cannot answer is disabled rather than hidden: a control
 * that vanishes reads as a bug, one that is greyed reads as a limit.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { TogglePill } from './TogglePill';

export interface ModeOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ModeChoiceProps<T extends string> {
  /** Which surface this row is for — "Hear", "See". */
  label: string;
  options: readonly ModeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each choice gets the testID `${testIDPrefix}-${value}`. */
  testIDPrefix: string;
}

export function ModeChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  testIDPrefix
}: ModeChoiceProps<T>): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.gray500 }]}>{label}</Text>
      <View style={styles.pills}>
        {options.map((option) => (
          <TogglePill
            key={option.value}
            testID={`${testIDPrefix}-${option.value}`}
            label={option.label}
            // Named for its row as well as itself, so a screen reader moving
            // through the list does not meet "As sung" twice over.
            accessibilityLabel={`${label} ${option.label.toLowerCase()}`}
            isOn={option.value === value}
            isDisabled={option.disabled === true}
            role="radio"
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

export default ModeChoice;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 13, fontWeight: '600', minWidth: 38 },
  pills: { flexDirection: 'row', gap: 6 }
});
