/**
 * The tempo, and setting it by hand.
 *
 * Every other reading on this screen can be corrected — a pitch, a downbeat, a
 * chord, how long a note lasts — and the tempo, which everything else is
 * measured against, could not. A wrong tempo does not merely say the wrong
 * number: the bar lines land wrong, the notation snaps to the wrong grid, and
 * every correction made on top of it inherits the error (INV-NOTES-123).
 *
 * It stands in front of the reading rather than replacing it, so the estimate
 * is still there to go back to — and so a re-read cannot silently undo a
 * decision a person made (INV-NOTES-116).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

/** One press. Small enough to land on a tempo, large enough to get there. */
const STEP = 1;

/** Below and above these, a tempo is not one anybody counts at. */
const MIN_BPM = 30;
const MAX_BPM = 300;

export interface TempoRowProps {
  /** The tempo in use, whether read or set. */
  bpm: number;
  /** What the take itself was read at, for going back to it. */
  readBpm: number;
  isByHand: boolean;
  onSet: (bpm: number | undefined) => void;
}

export function TempoRow({
  bpm,
  readBpm,
  isByHand,
  onSet
}: TempoRowProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!(bpm > 0)) {
    return null;
  }

  const step = (by: number) => () =>
    onSet(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm) + by)));

  const Button = ({ by, label }: { by: number; label: string }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={by > 0 ? 'Faster' : 'Slower'}
      onPress={step(by)}
      hitSlop={10}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: colors.neutral500,
          backgroundColor: pressed ? colors.neutral300 : 'transparent'
        }
      ]}
    >
      <Text style={[styles.stepText, { color: colors.primary500 }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View testID="tempo-row" style={styles.row}>
      <View style={styles.words}>
        <Text style={[styles.label, { color: colors.typography }]}>Tempo</Text>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {isByHand
            ? `Set by you. The take was read at ${Math.round(readBpm)}.`
            : 'Read from the take.'}
        </Text>
      </View>
      <View style={styles.controls}>
        <Button by={-STEP} label="−" />
        <Text
          accessibilityLabel={`${Math.round(bpm)} beats per minute`}
          style={[styles.value, { color: colors.typography }]}
        >
          {Math.round(bpm)}
        </Text>
        <Button by={STEP} label="+" />
      </View>
      {/* Offered only where there is something to undo (INV-NOTES-044). */}
      {isByHand ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use the tempo read from the take"
          onPress={() => onSet(undefined)}
          hitSlop={8}
        >
          <Text style={[styles.revert, { color: colors.primary500 }]}>
            Use what was read
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default TempoRow;

const styles = StyleSheet.create({
  row: { gap: 6, marginTop: 14 },
  words: { gap: 2 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  step: {
    borderWidth: 1,
    borderRadius: 999,
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: { fontSize: 18, fontWeight: '700', lineHeight: 20 },
  value: { fontSize: 20, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  revert: { fontSize: 12, fontWeight: '600' }
});
