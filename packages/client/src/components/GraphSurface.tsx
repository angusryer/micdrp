/**
 * GraphSurface — the one place a touch on the graph is interpreted.
 *
 * Every overlay used to carry its own full-size gesture layer, so whichever
 * was drawn last swallowed the touches meant for everything under it — the
 * chord notes were unreachable for exactly that reason. There is one layer
 * now, and the pieces beneath it only draw.
 *
 * Choosing comes before acting (INT-NOTES-015). A tap says which thing is
 * meant; a drag moves that thing and nothing else (INT-NOTES-016). Anything
 * else is the take being scrolled, which is why no hold is needed any more:
 * nothing is grabbed by accident because nothing is grabbed that was not
 * first chosen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import type { BarHandlePoint, Chosen } from './graphSelection';
import { useGraphGestures } from './useGraphGestures';

export interface GraphSurfaceProps {
  width: number;
  height: number;
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  notes: readonly NoteRect[];
  /** Height of one semitone lane, for turning a drag into pitch. */
  laneHeight: number;
  /** Step zero and step size, for turning a drag into a grid position. */
  originX: number;
  stepWidth: number;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  /** Move a bar line to a grid step. */
  onMoveBar: (lineIndex: number, step: number) => void;
  /** Move one note of one chord by whole semitones. */
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  /** Move one sung note by whole semitones, correcting what was heard. */
  onMoveNote: (index: number, semitones: number) => void;
  /** Put a new downbeat at a grid step. */
  onAddBar: (step: number) => void;
  /** The pitch a drag has just reached, once per semitone (INV-NOTES-070). */
  onHear?: (midi: number) => void;
}

export function GraphSurface({
  width,
  height,
  tones,
  bars,
  notes,
  laneHeight,
  originX,
  stepWidth,
  selection,
  onSelect,
  onMoveBar,
  onMoveTone,
  onMoveNote,
  onAddBar,
  onHear
}: GraphSurfaceProps): React.JSX.Element {
  const gesture = useGraphGestures({
    tones,
    bars,
    notes,
    laneHeight,
    originX,
    stepWidth,
    selection,
    onSelect,
    onMoveBar,
    onMoveTone,
    onMoveNote,
    onAddBar,
    onHear
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, { width, height }]} />
    </GestureDetector>
  );
}

export default GraphSurface;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 }
});
