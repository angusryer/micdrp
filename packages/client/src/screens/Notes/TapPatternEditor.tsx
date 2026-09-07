/**
 * Saying a tap pattern the presets do not contain (INV-NOTES-218).
 *
 * A phrase sung in six-eight and tapped on one, three and five is not any of
 * the offered patterns, and before this there was no way to say so. The
 * presets stay above — they are quick and usually right — but they are an
 * offer, not the vocabulary.
 *
 * Two controls because there are two facts: how long the bar is, and which
 * of its beats a hand hit. The bar is a count, so it steps; the beats are a
 * set, so they are picked. Neither is typed: a number pad over a sheet that
 * is watching bar lines move is a keyboard covering the thing being tuned.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MAX_BEATS_PER_BAR,
  MIN_BEATS_PER_BAR,
  withBeatToggled,
  withBeatsPerBar,
  type TapPattern
} from 'logic';

import { useTheme } from '../../theme';
import { TogglePill } from './TogglePill';

export interface TapPatternEditorProps {
  /** What is set now — the editor always works on a whole pattern. */
  pattern: TapPattern;
  isDisabled?: boolean;
  onSet: (pattern: TapPattern) => void;
}

export function TapPatternEditor({
  pattern,
  isDisabled = false,
  onSet
}: TapPatternEditorProps): React.JSX.Element {
  const { colors } = useTheme();
  const { beatsPerBar } = pattern;

  const step = (by: number) => {
    const next = beatsPerBar + by;
    if (next < MIN_BEATS_PER_BAR || next > MAX_BEATS_PER_BAR) {
      return;
    }
    onSet(withBeatsPerBar(pattern, next));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.counter}>
        <Text style={[styles.label, { color: colors.gray500 }]}>
          Beats in a bar
        </Text>
        <View style={styles.stepper}>
          <StepButton
            label="−"
            accessibilityLabel="One fewer beat in a bar"
            testID="beats-per-bar-down"
            isDisabled={isDisabled || beatsPerBar <= MIN_BEATS_PER_BAR}
            onPress={() => step(-1)}
          />
          <Text
            testID="beats-per-bar"
            accessibilityLabel={`${beatsPerBar} beats in a bar`}
            style={[styles.count, { color: colors.typography }]}
          >
            {beatsPerBar}
          </Text>
          <StepButton
            label="+"
            accessibilityLabel="One more beat in a bar"
            testID="beats-per-bar-up"
            isDisabled={isDisabled || beatsPerBar >= MAX_BEATS_PER_BAR}
            onPress={() => step(1)}
          />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.gray500 }]}>
        Beats you tapped
      </Text>
      <View style={styles.beats}>
        {Array.from({ length: beatsPerBar }, (_, i) => i + 1).map((beat) => (
          <TogglePill
            key={beat}
            label={String(beat)}
            accessibilityLabel={`Beat ${beat} of ${beatsPerBar} was tapped`}
            isOn={pattern.beats.includes(beat)}
            isDisabled={isDisabled}
            role="checkbox"
            testID={`tapped-beat-${beat}`}
            onPress={() => onSet(withBeatToggled(pattern, beat))}
          />
        ))}
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

export default TapPatternEditor;

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },
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
  count: { fontSize: 17, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  beats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
