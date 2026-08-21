/**
 * ChordTrack — the harmonic backdrop under a sung idea, as a chart you can move.
 *
 * One card per bar, laid out left to right in the order they are sung. A
 * progression longer than the screen is reached by dragging the track sideways;
 * the cards themselves answer only vertical drags and taps, so that drag always
 * lands here (INV-NOTES-017). Editing a single card lives in ChordCard.
 */
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import type { ChordSlot } from 'logic';

import { ChordCard } from './ChordCard';

export interface ChordTrackProps {
  slots: readonly ChordSlot[];
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

export function ChordTrack({
  slots,
  onNudge,
  onReshape,
  onAudition,
  onRevert
}: ChordTrackProps): React.JSX.Element | null {
  if (slots.length === 0) {
    return null;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {slots.map((slot, index) => (
        <ChordCard
          key={`${index}-${slot.startMs}`}
          slot={slot}
          index={index}
          onNudge={onNudge}
          onReshape={onReshape}
          onAudition={onAudition}
          onRevert={onRevert}
        />
      ))}
    </ScrollView>
  );
}

export default ChordTrack;

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 }
});
