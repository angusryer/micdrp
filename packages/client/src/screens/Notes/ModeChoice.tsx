/**
 * A two-way segmented choice: as sung, or as written down.
 *
 * Shared by HearItAs and SeeItAs. The same distinction is now offered twice on
 * one screen — once for what is heard, once for what is drawn — and two copies
 * of the control would let the two drift into looking like different questions.
 *
 * A choice the take cannot answer is disabled rather than hidden: a control
 * that vanishes reads as a bug, one that is greyed reads as a limit.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../theme';

export interface ModeOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ModeChoiceProps<T extends string> {
  options: readonly ModeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Each choice gets the testID `${testIDPrefix}-${value}`. */
  testIDPrefix: string;
}

export function ModeChoice<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix
}: ModeChoiceProps<T>): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.neutral500 }]}>
      {options.map((option) => {
        const isOn = option.value === value;
        const disabled = option.disabled === true;
        return (
          <TouchableOpacity
            key={option.value}
            testID={`${testIDPrefix}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.choice, isOn && { backgroundColor: colors.primary500 }]}
          >
            <Text
              style={[
                styles.choiceText,
                {
                  color: disabled
                    ? colors.gray300
                    : isOn
                      ? colors.white
                      : colors.typography
                }
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default ModeChoice;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden'
  },
  choice: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  choiceText: { fontSize: 14, fontWeight: '600' }
});
