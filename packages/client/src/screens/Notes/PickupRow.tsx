/**
 * The count-in in front of the take (INV-NOTES-250).
 *
 * Not a measurement any more. This used to say how far into a bar the
 * singing began, worked out from wherever the first bar line landed — so it
 * was a consequence of the bars rather than a statement about the music,
 * and it moved whenever they did.
 *
 * A count-in is a decision: how many beats you would give somebody before
 * they came in. Only the person who wrote the tune knows it, so they play
 * the take, tap the count they hear, and say how long it runs
 * (INV-NOTES-251).
 *
 * In the sheet that opens part way over the graph, so the count can be
 * watched appearing in front of the take as it is made (INV-NOTES-078).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Pickup } from 'logic';

import { useTheme } from '../../theme';
import { PickupMaker } from './PickupMaker';

export interface PickupRowProps {
  /** The count, or null where nobody has made one. */
  pickup: Pickup | null;
  onPlay: () => void;
  onStop: () => void;
  atMs: () => number;
  onMake: (taps: readonly number[], beats: number) => void;
  onClear: () => void;
}

/** "2 beats", and "none" for a take with no count in front of it. */
export function pickupLabel(beats: number): string {
  if (beats <= 0) {
    return 'None';
  }
  return beats === 1 ? '1 beat' : `${beats} beats`;
}

export function PickupRow({
  pickup,
  onPlay,
  onStop,
  atMs,
  onMake,
  onClear
}: PickupRowProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.typography }]}>Count-in</Text>
      <Text style={[styles.hint, { color: colors.gray300 }]}>
        {pickup == null
          ? 'Nothing counts you in. Play the take, tap the count you hear, and say how long it runs.'
          : `${pickupLabel(pickup.beats)} at ${Math.round(60000 / pickup.beatMs)} bpm, before the take starts.`}
      </Text>
      {pickup == null ? (
        <PickupMaker
          onPlay={onPlay}
          onStop={onStop}
          atMs={atMs}
          onMake={onMake}
          onCancel={onClear}
        />
      ) : (
        <Text
          accessibilityRole="button"
          accessibilityLabel="Take the count-in away"
          testID="pickup-clear"
          onPress={onClear}
          style={[styles.action, { color: colors.primary500 }]}
        >
          Take it away
        </Text>
      )}
    </View>
  );
}

export default PickupRow;

const styles = StyleSheet.create({
  row: { gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  action: { fontSize: 13, fontWeight: '600' }
});
