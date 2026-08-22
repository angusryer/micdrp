/**
 * The graph of one take: the sung line, the bars over it, the chords under it.
 *
 * Reading down, it is melody then harmony (INV-NOTES-029) — the same order the
 * two are heard in, and the order that leaves each chord beside the card that
 * edits it, which is the next thing on the screen below this one.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChordSlot } from 'logic';

import { MelodyView } from '../../components/MelodyView';
import type { MelodyGrid, MelodyNote } from '../../components/melodyLayout';
import { useTheme } from '../../theme';
import { BarRulerOverlay } from './BarRulerOverlay';
import { ChordLane } from './ChordLane';
import type { BarArrangement } from './useBarLayout';

/** Height of the piano-roll melody view. */
export const MELODY_VIEW_HEIGHT = 150;

export interface MelodyGraphProps {
  notes: readonly MelodyNote[];
  slots: readonly ChordSlot[];
  bars: BarArrangement;
  /** Absent until the take has a metre to draw, which the ruler also needs. */
  grid: MelodyGrid | undefined;
  width: number;
}

export function MelodyGraph({
  notes,
  slots,
  bars,
  grid,
  width
}: MelodyGraphProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      testID="melody-graph"
      style={[
        styles.card,
        { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
      ]}
    >
      {/* Sized to the melody exactly: the ruler fills this box, and a bar-line
          handle that spilled outside it would stop answering a touch. */}
      <View testID="graph-melody" style={[styles.melody, { width }]}>
        <MelodyView
          notes={notes}
          width={width}
          height={MELODY_VIEW_HEIGHT}
          grid={grid}
        />
        {/* Over the melody rather than beside it: the bars are a claim
            about this take, and correcting one means seeing both. */}
        {grid != null && (
          <BarRulerOverlay
            bars={bars}
            notes={notes}
            grid={grid}
            width={width}
            height={MELODY_VIEW_HEIGHT}
          />
        )}
      </View>
      <ChordLane slots={slots} notes={notes} width={width} />
    </View>
  );
}

export default MelodyGraph;

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8
  },
  // The ruler covers the melody alone, so the lane below it stays reachable.
  melody: { position: 'relative' }
});
