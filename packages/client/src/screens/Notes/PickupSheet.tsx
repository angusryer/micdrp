/**
 * What the count-in is made of (INV-NOTES-269).
 *
 * Opened by tapping the block itself, so the numbers behind a thing are
 * reached from the thing — a control for something already under the
 * finger is one nobody goes looking for.
 *
 * How long it runs is the only number to change here. Its pulse came from
 * the tapping and is shown rather than edited: a count tapped at one
 * speed and then typed to another is two claims about one thing. Where it
 * ends is placed by dragging the block (INV-NOTES-268), so this says
 * where it is rather than offering a second way to move it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Pickup } from 'logic';

import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';
import { CountStepper } from './CountStepper';

/** A count longer than this is a bar of its own, not a way in. */
const MOST_BEATS = 8;

export interface PickupSheetProps {
  pickup: Pickup | null;
  isOpen: boolean;
  onClose: () => void;
  onSetBeats: (beats: number) => void;
  onClear: () => void;
  onCover?: (name: string, px: number) => void;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export function PickupSheet({
  pickup,
  isOpen,
  onClose,
  onSetBeats,
  onClear,
  onCover
}: PickupSheetProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Sheet name="pickup" isOpen={isOpen} onClose={onClose} onCover={onCover}>
      <View style={styles.body} testID="pickup-sheet">
        <Text style={[styles.title, { color: colors.typography }]}>Count-in</Text>
        {pickup == null ? (
          <Text style={[styles.hint, { color: colors.gray300 }]}>
            This take has no count-in.
          </Text>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.gray300 }]}>
              {Math.round(60000 / pickup.beatMs)} bpm, from the steady part of
              your tapping. It ends at {seconds(pickup.endMs)} — drag the block
              on the graph to put that on the moment you come in.
            </Text>
            <CountStepper
              label="Beats before you come in"
              value={pickup.beats}
              min={1}
              max={MOST_BEATS}
              describe={(n) => (n === 1 ? 'A count of 1 beat' : `A count of ${n} beats`)}
              downLabel="A shorter count"
              upLabel="A longer count"
              testID="pickup-sheet-beats"
              onSet={onSetBeats}
            />
            <Text
              accessibilityRole="button"
              accessibilityLabel="Take the count-in away"
              testID="pickup-sheet-clear"
              onPress={onClear}
              style={[styles.action, { color: colors.primary500 }]}
            >
              Take it away
            </Text>
          </>
        )}
      </View>
    </Sheet>
  );
}

export default PickupSheet;

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  action: { fontSize: 14, fontWeight: '600', paddingVertical: 6 }
});
