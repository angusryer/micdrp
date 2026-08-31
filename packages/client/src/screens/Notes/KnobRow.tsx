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
 *
 * Two step sizes, because the search has two halves (INV-NOTES-182). The
 * double marks cross the range in about ten presses, which is how you find
 * roughly where the answer is; the single marks move by the smallest amount
 * the knob takes, which is how you settle on it. Both land on the same grid,
 * so a value found with one can be adjusted with the other.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
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
  /** Which way, and whether in the big amount or the small one. */
  onStep: (by: 1 | -1, size: 'coarse' | 'fine') => void;
  /** Put this one back where it started, without touching the others. */
  onReset: () => void;
}

export function KnobRow({
  knob,
  value,
  isOpen,
  onExplain,
  onStep,
  onReset
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
          accessibilityLabel={`Lower ${knob.title} a lot`}
          testID={`knob-${knob.key}-down-coarse`}
          onPress={() => onStep(-1, 'coarse')}
          hitSlop={8}
          style={styles.step}
        >
          <Text style={[styles.stepText, { color: colors.primary500 }]}>
            −−
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lower ${knob.title}`}
          testID={`knob-${knob.key}-down`}
          onPress={() => onStep(-1, 'fine')}
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
          onPress={() => onStep(1, 'fine')}
          hitSlop={8}
          style={styles.step}
        >
          <Text style={[styles.stepText, { color: colors.primary500 }]}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Raise ${knob.title} a lot`}
          testID={`knob-${knob.key}-up-coarse`}
          onPress={() => onStep(1, 'coarse')}
          hitSlop={8}
          style={styles.step}
        >
          <Text style={[styles.stepText, { color: colors.primary500 }]}>
            ++
          </Text>
        </Pressable>
        {/* One knob back, rather than all of them. Tuning is a search, and a
            search needs to undo the last step without losing the others. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reset ${knob.title}`}
          testID={`knob-${knob.key}-reset`}
          onPress={onReset}
          hitSlop={8}
          style={styles.step}
        >
          <Icon
            name="reset"
            size={14}
            color={value === knob.fallback ? colors.neutral500 : colors.gray300}
          />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1 },
  label: { fontSize: 14 },
  step: { paddingHorizontal: 4, paddingVertical: 4 },
  stepText: { fontSize: 20, fontWeight: '700' },
  // Fixed width so a column of numbers does not jitter as they change.
  value: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    minWidth: 58,
    textAlign: 'right'
  },
  hint: { fontSize: 12, paddingBottom: 6 }
});
