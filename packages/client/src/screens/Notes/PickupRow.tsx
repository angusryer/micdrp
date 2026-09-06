/**
 * How far into a bar the singing started (INV-NOTES-211).
 *
 * The pickup could only be changed by dragging the first bar line, which
 * holds that line between its neighbours — so it resized the first bar
 * instead of shifting the music, and saying "this take has a two-beat
 * pickup" meant dragging every line in turn and hoping they stayed even.
 *
 * Beside the tap pattern because they are the same kind of sentence: both
 * say where the bar sits, and neither is a reading of the take. In the sheet
 * that opens part way over the graph, so the bar lines can be watched moving
 * as it changes (INV-NOTES-078).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { TogglePill } from './TogglePill';

export interface PickupRowProps {
  /** How long the pickup runs, in beats. */
  beats: number;
  /** How many beats a bar holds, which bounds the pickup. */
  beatsPerBar: number;
  onSet: (beats: number) => void;
}

/** "2 beats", and "none" for a take that opens on a downbeat. */
export function pickupLabel(beats: number): string {
  if (beats <= 0) {
    return 'None';
  }
  return beats === 1 ? '1 beat' : `${beats} beats`;
}

export function PickupRow({
  beats,
  beatsPerBar,
  onSet
}: PickupRowProps): React.JSX.Element | null {
  const { colors } = useTheme();

  // Nothing to divide a pickup out of. A bar of one beat cannot have a note
  // before its own downbeat.
  if (!(beatsPerBar > 1)) {
    return null;
  }

  // A pickup is less than a bar: a whole bar before the first downbeat is
  // just an earlier downbeat.
  const choices = Array.from({ length: beatsPerBar }, (_, i) => i);

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.typography }]}>Pickup</Text>
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        {beats > 0
          ? `The singing starts ${pickupLabel(beats).toLowerCase()} before the first full bar.`
          : 'The take opens on a downbeat.'}
      </Text>
      <View style={styles.pills}>
        {choices.map((choice) => (
          <TogglePill
            key={choice}
            label={pickupLabel(choice)}
            accessibilityLabel={
              choice === 0
                ? 'The take opens on a downbeat'
                : `A pickup of ${pickupLabel(choice).toLowerCase()}`
            }
            isOn={beats === choice}
            role="radio"
            testID={`pickup-${choice}`}
            onPress={() => onSet(choice)}
          />
        ))}
      </View>
    </View>
  );
}

export default PickupRow;

const styles = StyleSheet.create({
  row: { gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
