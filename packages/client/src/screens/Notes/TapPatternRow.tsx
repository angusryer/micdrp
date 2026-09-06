/**
 * What the taps were for (INV-NOTES-209).
 *
 * Tapping every beat to establish a tempo is most of a performance spent on
 * bookkeeping — and mid-song you do not yet know whether you will tap every
 * beat or only the backbeat. So the tap means nothing and the meaning is
 * supplied here, afterwards, by the only person who knows it.
 *
 * Beside the tempo because it is one: setting it is how the taps become a
 * tempo at all. It sits in the sheet that opens part way over the graph, so
 * the bar lines can be watched moving as it changes (INV-NOTES-078).
 *
 * "Nobody has said" is the first choice and the one a take starts on. Taking
 * the pattern back brings the grid it had, because nothing was overwritten
 * to get here (INV-NOTES-161).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TAP_PATTERNS, samePattern, type TapPattern } from 'logic';

import { useTheme } from '../../theme';
import { TogglePill } from './TogglePill';

/** How few taps make a pattern unreadable, whatever it claims. */
const MIN_TAPS = 2;

export interface TapPatternRowProps {
  /** What was said, or undefined where nobody has. */
  pattern: TapPattern | undefined;
  /** How many taps there are to read it through. */
  tapCount: number;
  /** What those taps say through it, or null where they say nothing. */
  bpm: number | null;
  onSet: (pattern: TapPattern | undefined) => void;
}

/** "2 and 4 of 4", which is how a person would say it out loud. */
export function patternLabel(pattern: TapPattern): string {
  const { beats, beatsPerBar } = pattern;
  const list =
    beats.length === beatsPerBar
      ? 'every beat'
      : beats.length === 1
        ? `beat ${beats[0]}`
        : `${beats.slice(0, -1).join(', ')} and ${beats[beats.length - 1]}`;
  return `${list} of ${beatsPerBar}`;
}

export function TapPatternRow({
  pattern,
  tapCount,
  bpm,
  onSet
}: TapPatternRowProps): React.JSX.Element | null {
  const { colors } = useTheme();

  // Nothing was tapped, so there is nothing to say anything about. A control
  // for a take with no taps is a question with no answer.
  if (tapCount === 0) {
    return null;
  }

  const tooFew = tapCount < MIN_TAPS;

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.typography }]}>
        The beat you tapped
      </Text>
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        {tooFew
          ? 'One tap marks a moment. Two or more can say where the beat is, once you say which beats they were.'
          : pattern == null
            ? `${tapCount} taps, held as marks. Say which beats they were and they become the tempo.`
            : bpm == null
              ? 'These taps do not sit on that pattern evenly enough to read a tempo from.'
              : `${Math.round(bpm)} bpm, from ${tapCount} taps.`}
      </Text>
      <View style={styles.pills}>
        <TogglePill
          label="Not set"
          accessibilityLabel="The taps are marks and say nothing about the beat"
          isOn={pattern == null}
          // One of a set of answers to one question, so a radio rather than
          // a checkbox — and the screen reader is told so.
          role="radio"
          testID="tap-pattern-none"
          onPress={() => onSet(undefined)}
        />
        {TAP_PATTERNS.map((choice) => (
          <TogglePill
            key={patternLabel(choice)}
            label={patternLabel(choice)}
            accessibilityLabel={`The taps were ${patternLabel(choice)}`}
            isOn={pattern != null && samePattern(pattern, choice)}
            isDisabled={tooFew}
            role="radio"
            onPress={() => onSet(choice)}
          />
        ))}
      </View>
    </View>
  );
}

export default TapPatternRow;

const styles = StyleSheet.create({
  row: { gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
