/**
 * One threshold, and what moving it does (INV-NOTES-172).
 *
 * Its own component because the panel is a list of these and the panel's job
 * is the grouping — and because what a row does with a press is a different
 * question from which rows there are.
 *
 * Stepped rather than dragged. Tuning a detector is a search for a boundary,
 * and a boundary is found by taking one step and listening, not by sliding
 * past it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import type { ReadingKnob } from '../../analysis/readingKnobs';

/** How a value is written, so a step is legible at a glance. */
function shown(knob: ReadingKnob, value: number): string {
  const n = value.toFixed(knob.decimals ?? 0);
  return knob.unit ? `${n}${knob.unit}` : n;
}

export interface KnobRowProps {
  knob: ReadingKnob;
  value: number;
  isOpen: boolean;
  onExplain: () => void;
  onStep: (by: 1 | -1) => void;
}

export function KnobRow({
  knob,
  value,
  isOpen,
  onExplain,
  onStep
}: KnobRowProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={knob.title}
          onPress={onExplain}
          style={styles.name}
        >
          <Text style={[styles.label, { color: colors.typography }]}>
            {knob.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lower ${knob.title}`}
          testID={`knob-${knob.key}-down`}
          onPress={() => onStep(-1)}
          hitSlop={8}
          style={styles.step}
        >
          <Text style={[styles.stepText, { color: colors.primary500 }]}>−</Text>
        </Pressable>
        <Text style={[styles.value, { color: colors.typography }]}>
          {shown(knob, value)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Raise ${knob.title}`}
          testID={`knob-${knob.key}-up`}
          onPress={() => onStep(1)}
          hitSlop={8}
          style={styles.step}
        >
          <Text style={[styles.stepText, { color: colors.primary500 }]}>+</Text>
        </Pressable>
      </View>
      {/* On the one being considered. Eleven sentences at once is a wall
          nobody reads. */}
      {isOpen ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>{knob.hint}</Text>
      ) : null}
    </View>
  );
}

export default KnobRow;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1 },
  label: { fontSize: 14 },
  step: { paddingHorizontal: 6, paddingVertical: 4 },
  stepText: { fontSize: 20, fontWeight: '700' },
  // Fixed width so a column of numbers does not jitter as they change.
  value: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    minWidth: 62,
    textAlign: 'right'
  },
  hint: { fontSize: 12, paddingBottom: 6 }
});
