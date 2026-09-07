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
import { StyleSheet, Text, View } from 'react-native';

import {
  MAX_BEATS_PER_BAR,
  MIN_BEATS_PER_BAR,
  withBeatToggled,
  withBeatsPerBar,
  type TapPattern
} from 'logic';

import { useTheme } from '../../theme';
import { CountStepper } from './CountStepper';
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

  return (
    <View style={styles.wrap}>
      <CountStepper
        label="Beats in a bar"
        value={beatsPerBar}
        min={MIN_BEATS_PER_BAR}
        max={MAX_BEATS_PER_BAR}
        describe={(n) => `${n} beats in a bar`}
        downLabel="One fewer beat in a bar"
        upLabel="One more beat in a bar"
        testID="beats-per-bar"
        isDisabled={isDisabled}
        onSet={(n) => onSet(withBeatsPerBar(pattern, n))}
      />

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

export default TapPatternEditor;

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },
  label: { fontSize: 13 },
  beats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
