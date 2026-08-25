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
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import type {
  BarHandlePoint,
  BeatLine,
  Chosen,
  HitPoint
} from './graphSelection';
import { DragLoupe } from './DragLoupe';
import { useGraphGestures, type DragPreview } from './useGraphGestures';

export interface GraphSurfaceProps {
  width: number;
  height: number;
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  notes: readonly NoteRect[];
  /** The layer's notes, drawn behind the sung line (INV-NOTES-118). */
  layerNotes?: readonly NoteRect[];
  /** Where each struck sound's mark sits, in the band below the drawing. */
  hits?: readonly HitPoint[];
  /** Where each tapped beat is drawn (INV-NOTES-130). */
  beats?: readonly BeatLine[];
  /** Height of one semitone lane, for turning a drag into pitch. */
  laneHeight: number;
  /** Step zero and step size, for turning a drag into a grid position. */
  originX: number;
  stepWidth: number;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  /** Move a bar line to a grid step. */
  onMoveBar: (lineIndex: number, step: number) => void;
  /** Move a tapped beat to a pixel position (INV-NOTES-130). */
  onMoveBeat?: (index: number, x: number) => void;
  /** Throw a vertical line away, flicked across it (INV-NOTES-132). */
  onRemoveBar?: (lineIndex: number) => void;
  onRemoveBeat?: (index: number) => void;
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
  layerNotes = [],
  hits = [],
  beats = [],
  laneHeight,
  originX,
  stepWidth,
  selection,
  onSelect,
  onMoveBar,
  onMoveBeat,
  onRemoveBar,
  onRemoveBeat,
  onMoveTone,
  onMoveNote,
  onAddBar,
  onHear
}: GraphSurfaceProps): React.JSX.Element {
  // Held here rather than reported upward: the readout belongs over the
  // graph it is placing something on, and nothing above needs to know a drag
  // is in flight (INV-NOTES-025).
  const [preview, setPreview] = useState<DragPreview | null>(null);

  const gesture = useGraphGestures({
    tones,
    bars,
    notes,
    layerNotes,
    hits,
    beats,
    laneHeight,
    originX,
    stepWidth,
    selection,
    onSelect,
    onMoveBar,
    onMoveBeat,
    onRemoveBar,
    onRemoveBeat,
    onMoveTone,
    onMoveNote,
    onAddBar,
    onHear,
    onPreview: setPreview
  });

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={[styles.fill, { width, height }]} />
      </GestureDetector>
      <DragLoupe
        isVisible={preview != null}
        touchX={preview?.x ?? 0}
        touchY={preview?.y ?? 0}
        bounds={{ width, height }}
        value={preview?.value ?? ''}
        caption={preview?.caption}
        midi={preview?.midi}
      />
    </>
  );
}

export default GraphSurface;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 }
});
