/**
 * A count with a minus and a plus, and the number readable between them.
 *
 * Two rows in this sheet ask the same kind of question — how long is the bar,
 * how long is the pickup — and a row of one pill per possible answer answers
 * it badly: it grows with the range, it reads as a set of alternatives rather
 * than a quantity, and at six or eight beats it is a wall of numbers to scan
 * for the one already chosen.
 *
 * The number is drawn, not only nudged. A stepper whose current value is
 * implied by which end is greyed is a stepper you have to count your way
 * through.
 *
 * Shared rather than written twice: the second copy is where two controls
 * that ask the same question start behaving differently.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

export interface CountStepperProps {
  /** What is being counted, drawn beside the control. */
  label: string;
  value: number;
  min: number;
  max: number;
  /** What the number means aloud — "6 beats in a bar", not "6". */
  describe: (value: number) => string;
  downLabel: string;
  upLabel: string;
  /** Prefix for the three testIDs: `<id>`, `<id>-down`, `<id>-up`. */
  testID: string;
  isDisabled?: boolean;
  onSet: (value: number) => void;
}

export function CountStepper({
  label,
  value,
  min,
  max,
  describe,
  downLabel,
  upLabel,
  testID,
  isDisabled = false,
  onSet
}: CountStepperProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.counter}>
      <Text style={[styles.label, { color: colors.gray500 }]}>{label}</Text>
      <View style={styles.stepper}>
        <StepButton
          label="−"
          accessibilityLabel={downLabel}
          testID={`${testID}-down`}
          isDisabled={isDisabled || value <= min}
          onPress={() => onSet(value - 1)}
        />
        <Text
          testID={testID}
          accessibilityLabel={describe(value)}
          style={[styles.count, { color: colors.typography }]}
        >
          {value}
        </Text>
        <StepButton
          label="+"
          accessibilityLabel={upLabel}
          testID={`${testID}-up`}
          isDisabled={isDisabled || value >= max}
          onPress={() => onSet(value + 1)}
        />
      </View>
    </View>
  );
}

/** One end of the stepper. Its own component so the two cannot drift. */
function StepButton({
  label,
  accessibilityLabel,
  testID,
  isDisabled,
  onPress
}: {
  label: string;
  accessibilityLabel: string;
  testID: string;
  isDisabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled }}
      testID={testID}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: colors.neutral500,
          backgroundColor: pressed ? colors.neutral300 : 'transparent',
          opacity: isDisabled ? 0.4 : 1
        }
      ]}
    >
      <Text style={[styles.stepText, { color: colors.typography }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default CountStepper;

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: {
    borderWidth: 1,
    borderRadius: 999,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
  // Fixed width so the row does not jump as the count changes shape.
  count: { fontSize: 17, fontWeight: '700', minWidth: 24, textAlign: 'center' }
});
