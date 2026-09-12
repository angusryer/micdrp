/**
 * Making a count-in: play the take, tap the count, say how long it runs
 * (INV-NOTES-250, INV-NOTES-251).
 *
 * Two steps and no more. Tapping along while the take plays is the only way
 * a person can state a pulse they are hearing rather than one they are
 * reading off a number — and how many beats the count runs for is a
 * separate question, because it is a decision about the arrangement rather
 * than about the pulse.
 *
 * The pulse is read from the steadiest run of the taps, so the fumble at
 * the start and the trail-off at the end cost nothing. That is what lets
 * this be one pass rather than a metronome to match.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { steadiestPulseMs } from 'logic';

import { useTheme } from '../../theme';
import { tapped } from '../../utilities/haptics';

/** What a count-in usually runs for, and the most worth offering. */
const CHOICES = [1, 2, 3, 4, 6, 8];

export interface PickupMakerProps {
  /** Start the take sounding, so there is something to count against. */
  onPlay: () => void;
  onStop: () => void;
  /** Where the take has reached, in ms, asked at each tap. */
  atMs: () => number;
  /** Keep the count: the taps of the pass, and how many beats it runs. */
  onMake: (taps: readonly number[], beats: number) => void;
  onCancel: () => void;
}

export function PickupMaker({
  onPlay,
  onStop,
  atMs,
  onMake,
  onCancel
}: PickupMakerProps): React.JSX.Element {
  const { colors } = useTheme();
  const [taps, setTaps] = useState<number[] | null>(null);
  const [counting, setCounting] = useState(false);

  const begin = useCallback(() => {
    setTaps([]);
    setCounting(true);
    onPlay();
  }, [onPlay]);

  const finish = useCallback(() => {
    setCounting(false);
    onStop();
  }, [onStop]);

  const tap = useCallback(() => {
    tapped();
    setTaps((was) => [...(was ?? []), atMs()]);
  }, [atMs]);

  // Worked out as soon as the pass ends, so the question that follows can
  // be asked at all: with no steady run there is no count to size.
  const pulse = taps == null ? null : steadiestPulseMs(taps);

  if (counting) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          Tap the count you would give somebody. Start and stop raggedly if
          you like — only the steady part is read.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap the count"
          testID="pickup-tap"
          onPressIn={tap}
          style={[
            styles.pad,
            { borderColor: colors.primary500, backgroundColor: colors.neutral100 }
          ]}
        >
          <Text style={[styles.padText, { color: colors.primary500 }]}>
            {taps?.length ? `${taps.length} tapped` : 'Tap the count'}
          </Text>
        </Pressable>
        <Text
          accessibilityRole="button"
          testID="pickup-stop"
          onPress={finish}
          style={[styles.action, { color: colors.primary500 }]}
        >
          Stop
        </Text>
      </View>
    );
  }

  if (taps == null) {
    return (
      <View style={styles.wrap}>
        <Text
          accessibilityRole="button"
          accessibilityLabel="Add a count-in"
          testID="pickup-begin"
          onPress={begin}
          style={[styles.action, { color: colors.primary500 }]}
        >
          Add a count-in
        </Text>
      </View>
    );
  }

  if (pulse == null) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {taps.length < 3
            ? 'Too few taps to read a pulse from. Three or more.'
            : 'Nothing steady enough in that pass to read a pulse from.'}
        </Text>
        <Text
          accessibilityRole="button"
          testID="pickup-again"
          onPress={begin}
          style={[styles.action, { color: colors.primary500 }]}
        >
          Try again
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        {Math.round(60000 / pulse)} bpm, from the steady part of{' '}
        {taps.length} taps. How many beats does the count run for?
      </Text>
      <View style={styles.choices}>
        {CHOICES.map((beats) => (
          <Text
            key={beats}
            accessibilityRole="button"
            accessibilityLabel={`A count-in of ${beats} beats`}
            testID={`pickup-beats-${beats}`}
            onPress={() => onMake(taps, beats)}
            style={[
              styles.choice,
              { color: colors.primary500, borderColor: colors.neutral500 }
            ]}
          >
            {beats}
          </Text>
        ))}
      </View>
      <Text
        accessibilityRole="button"
        testID="pickup-cancel"
        onPress={onCancel}
        style={[styles.action, { color: colors.gray300 }]}
      >
        Never mind
      </Text>
    </View>
  );
}

export default PickupMaker;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
  // Large. This is played rather than pressed, and a small target is a
  // mistimed one.
  pad: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 26,
    alignItems: 'center'
  },
  padText: { fontSize: 16, fontWeight: '700' },
  action: { fontSize: 13, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14
  }
});
