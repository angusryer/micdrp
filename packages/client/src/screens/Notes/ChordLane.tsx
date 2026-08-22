/**
 * ChordLane — the chords a take implied, drawn along the bottom of its graph.
 *
 * A reading, not a control: it says where each chord falls across the take, on
 * the melody's own time axis, with the sung line above it and the cards that
 * edit it directly below (INV-NOTES-029). Editing stays on the cards, so the
 * lane answers no gesture and cannot race the bar ruler over the melody.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChordSlot } from 'logic';

import { layoutMelody, type MelodyNote } from '../../components/melodyLayout';
import { useTheme } from '../../theme';
import { layoutChordLane } from './chordLaneModel';

/** Height of the lane strip, in px. */
export const CHORD_LANE_HEIGHT = 24;

/** Narrowest band that can hold a chord name, in px. */
const LABEL_MIN_WIDTH = 26;

export interface ChordLaneProps {
  slots: readonly ChordSlot[];
  /** The same notes the melody above was drawn from, so the axes agree. */
  notes: readonly MelodyNote[];
  width: number;
}

export function ChordLane({
  slots,
  notes,
  width
}: ChordLaneProps): React.JSX.Element | null {
  const { colors } = useTheme();

  // Height plays no part in the time axis, so the lane asks for the melody's
  // layout at any height rather than having to know the one it was drawn at.
  const bands = useMemo(
    () => layoutChordLane(slots, layoutMelody(notes, { width, height: 1 }).timeAxis),
    [slots, notes, width]
  );

  if (bands.length === 0) {
    return null;
  }

  return (
    <View
      testID="chord-lane"
      style={[styles.lane, { width, height: CHORD_LANE_HEIGHT }]}
    >
      {bands.map((band) => (
        <View
          key={band.index}
          testID={`chord-band-${band.index}`}
          style={[
            styles.band,
            {
              left: band.x,
              width: band.width,
              backgroundColor: band.isEdited
                ? colors.primary100
                : colors.neutral100,
              borderColor: band.isEdited ? colors.primary500 : colors.neutral500
            }
          ]}
        >
          {band.width >= LABEL_MIN_WIDTH ? (
            <Text
              numberOfLines={1}
              style={[styles.label, { color: colors.typography }]}
            >
              {band.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default ChordLane;

const styles = StyleSheet.create({
  lane: { marginTop: 4 },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2
  },
  label: { fontSize: 11, fontWeight: '600' }
});
