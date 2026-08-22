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
 *
 * Nothing is ever drawn wider than the chord it describes. A chord too narrow
 * at this scale becomes a mark rather than a squeezed card (INV-NOTES-063) —
 * a card allowed to overflow its span covers its neighbour, and a hidden
 * chord is worse than a small one.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChordSlot } from 'logic';

import { xForMs, type TimeAxis } from '../../components/melodyScale';
import { ChordCard } from './ChordCard';
import { ChordSqueeze } from './ChordSqueeze';

/**
 * The narrowest a card can be and still say which chord it is.
 *
 * Below this the chord is drawn as a mark instead. Widening the card past its
 * own span was the other option and a worse one: it hides whatever comes
 * next, and a chord you cannot see at all is worse than one you have to zoom
 * in to read.
 */
export const MIN_CARD_WIDTH = 44;

export interface ChordTrackProps {
  slots: readonly ChordSlot[];
  /** The graph's mapping from time to x, so a card sits under its own bar. */
  timeAxis: TimeAxis;
  /** The drawing's width, which is what the cards are laid out across. */
  contentWidth: number;
  /**
   * Zoom the graph by a factor, held about a point. A chord too narrow to
   * read asks for exactly enough to become readable.
   */
  onReveal: (factor: number, focalX: number) => void;
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

export function ChordTrack({
  slots,
  timeAxis,
  contentWidth,
  onReveal,
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
        // Its own span, never more: a card wider than its chord sits on the
        // next one (INV-NOTES-063).
        const width = xForMs(timeAxis, slot.endMs) - left;
        return (
          <View
            key={`${index}-${slot.startMs}`}
            testID={`chord-slot-${index}`}
            style={[styles.slot, { left, width }]}
          >
            {width >= MIN_CARD_WIDTH ? (
              <ChordCard
                slot={slot}
                index={index}
                width={Math.max(1, width - CARD_GAP)}
                onNudge={onNudge}
                onReshape={onReshape}
                onAudition={onAudition}
                onRevert={onRevert}
              />
            ) : (
              <ChordSqueeze
                label={slot.label}
                bar={slot.bar}
                onPress={() =>
                  onReveal(MIN_CARD_WIDTH / Math.max(1, width), left + width / 2)
                }
              />
            )}
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
