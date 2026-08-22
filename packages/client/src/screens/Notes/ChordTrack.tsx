/**
 * ChordTrack — the harmonic backdrop, laid out under the bars it belongs to.
 *
 * One card per downbeat, each starting exactly where its chord starts on the
 * graph above (INV-NOTES-061). It used to be an independent row that scrolled
 * on its own, so a card and the bar it described only lined up at the very
 * start of the take and drifted apart from there — which made the cards a
 * list of chords rather than a reading of this one.
 *
 * It takes the graph's own time axis and is drawn inside the graph's scroll,
 * so there is one mapping and one scroll position. Editing a single card
 * lives in ChordCard; the cards answer only vertical drags and taps, so a
 * sideways drag still travels the take (INV-NOTES-017).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChordSlot } from 'logic';

import { xForMs, type TimeAxis } from '../../components/melodyScale';
import { ChordCard } from './ChordCard';

/**
 * Narrow enough to be a thumb's target still.
 *
 * Zoomed far enough out a chord's own span falls below this and neighbouring
 * cards start to overlap. Letting them shrink instead would give a row of
 * unreadable slivers that cannot be tapped, and the alignment — which is the
 * whole point — is carried by the left edge either way.
 */
const MIN_CARD_WIDTH = 44;

export interface ChordTrackProps {
  slots: readonly ChordSlot[];
  /** The graph's mapping from time to x, so a card sits under its own bar. */
  timeAxis: TimeAxis;
  /** The drawing's width, which is what the cards are laid out across. */
  contentWidth: number;
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

export function ChordTrack({
  slots,
  timeAxis,
  contentWidth,
  onNudge,
  onReshape,
  onAudition,
  onRevert
}: ChordTrackProps): React.JSX.Element | null {
  if (slots.length === 0) {
    return null;
  }
  return (
    <View style={[styles.row, { width: contentWidth }]}>
      {slots.map((slot, index) => {
        const left = xForMs(timeAxis, slot.startMs);
        const width = Math.max(
          MIN_CARD_WIDTH,
          xForMs(timeAxis, slot.endMs) - left
        );
        return (
          <View
            key={`${index}-${slot.startMs}`}
            testID={`chord-slot-${index}`}
            style={[styles.slot, { left, width }]}
          >
            <ChordCard
              slot={slot}
              index={index}
              width={width - CARD_GAP}
              onNudge={onNudge}
              onReshape={onReshape}
              onAudition={onAudition}
              onRevert={onRevert}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Daylight between one card and the next, so two chords never read as one. */
const CARD_GAP = 4;

export default ChordTrack;

const styles = StyleSheet.create({
  row: { flex: 1, paddingVertical: 2 },
  slot: { position: 'absolute', top: 0 }
});
