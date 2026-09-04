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
 *
 * It renders even when nothing could be read from the take (INV-NOTES-196).
 * It used to render only when a tempo was already known, so the one take that
 * most needed a tempo stated — the one nothing could be read from — was the
 * one take that could not be given one.
 *
 * Where beats have been tapped, the tempo they imply is offered as the value
 * to start from. Offering is not inferring: a tapped beat stays a mark and
 * reads no tempo on its own (INV-NOTES-161), and this only puts what the
 * marks imply in front of the person who made them. That distinction is the
 * whole of why that rule exists — four taps once re-cut the harmony of a take
 * somebody was in the middle of reading, and no offer can do that.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';

/** One press. Small enough to land on a tempo, large enough to get there. */
const STEP = 1;

/** Below and above these, a tempo is not one anybody counts at. */
const MIN_BPM = 30;
const MAX_BPM = 300;

/** Where to start from when nothing was read and nothing was tapped. */
const UNKNOWN_START = 100;

export interface TempoRowProps {
  /** The tempo in use, whether read or set. */
  bpm: number;
  /** What the take itself was read at, for going back to it. */
  readBpm: number;
  isByHand: boolean;
  /**
   * The tempo the tapped beats imply, or null. Offered, never applied —
   * the taps are marks and stay marks until this is pressed.
   */
  tappedBpm?: number | null;
  onSet: (bpm: number | undefined) => void;
}

export function TempoRow({
  bpm,
  readBpm,
  isByHand,
  tappedBpm = null,
  onSet
}: TempoRowProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const offered =
    tappedBpm != null && tappedBpm >= MIN_BPM && tappedBpm <= MAX_BPM
      ? Math.round(tappedBpm)
      : null;

  // Nothing was read. The row still appears, because this is the take that
  // most needs a tempo stated (INV-NOTES-196).
  if (!(bpm > 0)) {
    return (
      <View testID="tempo-row" style={styles.row}>
        <View style={styles.words}>
          <Text style={[styles.label, { color: colors.typography }]}>Tempo</Text>
          <Text style={[styles.hint, { color: colors.gray300 }]}>
            {offered == null
              ? 'None could be read from this take.'
              : `None could be read. Your taps are at about ${offered}.`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            offered == null
              ? 'Set a tempo by hand'
              : `Use the tempo you tapped, ${offered} beats per minute`
          }
          onPress={() => onSet(offered ?? UNKNOWN_START)}
          hitSlop={8}
        >
          <Text style={[styles.revert, { color: colors.primary500 }]}>
            {offered == null ? 'Set one by hand' : `Use ${offered}`}
          </Text>
        </Pressable>
      </View>
    );
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
      {/* What the taps imply, where they imply something else entirely.
          Still an offer: pressing is what applies it (INV-NOTES-161). */}
      {offered != null && offered !== Math.round(bpm) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use the tempo you tapped, ${offered} beats per minute`}
          onPress={() => onSet(offered)}
          hitSlop={8}
        >
          <Text style={[styles.revert, { color: colors.primary500 }]}>
            {`Use what you tapped (${offered})`}
          </Text>
        </Pressable>
      ) : null}
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
