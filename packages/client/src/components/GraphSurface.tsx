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
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import type {
  BarHandlePoint,
  BeatLine,
  Chosen,
  HitPoint
} from './graphSelection';
import { DragLoupe } from './DragLoupe';

/**
 * What the loupe says, as against where it is.
 *
 * Its own type because the two are held apart: this changes on a semitone
 * crossing and is worth a render, the position changes every frame and is not
 * (INV-NOTES-235).
 */
type LoupeWords = Pick<DragPreview, 'midi' | 'value' | 'caption'>;
import { useGraphGestures, type DragPreview } from './useGraphGestures';
import { NOTHING } from '../utilities/nothing';

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
  /** Whether a dragged line lands on the grid (INV-NOTES-143). */
  isSnapping?: boolean;
  /** The pitch a drag has just reached, once per semitone (INV-NOTES-070). */
  onHear?: (midi: number) => void;
}

export function GraphSurface({
  width,
  height,
  tones,
  bars,
  notes,
  layerNotes = NOTHING,
  hits = NOTHING,
  beats = NOTHING,
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
  isSnapping,
  onHear
}: GraphSurfaceProps): React.JSX.Element {
  // Held here rather than reported upward: the readout belongs over the
  // graph it is placing something on, and nothing above needs to know a drag
  // is in flight (INV-NOTES-025).
  //
  // Split in two, because the two halves change at different rates
  // (INV-NOTES-235). Where the finger is changes every frame and goes to the
  // UI thread, which draws it without a render. What it says changes only
  // when the note crosses a semitone, and that is worth a render.
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const [said, setSaid] = useState<LoupeWords | null>(null);

  const preview = useCallback(
    (next: DragPreview | null) => {
      if (next == null) {
        setSaid(null);
        return;
      }
      touchX.value = next.x;
      touchY.value = next.y;
      // Only when the words change. They are the same for every frame between
      // one semitone and the next, and setting them again would be a render
      // that redraws exactly what is already there.
      setSaid((was) =>
        was != null &&
        was.midi === next.midi &&
        was.value === next.value &&
        was.caption === next.caption
          ? was
          : { midi: next.midi, value: next.value, caption: next.caption }
      );
    },
    [touchX, touchY]
  );

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
    snapToGrid: isSnapping,
    onHear,
    onPreview: preview
  });

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={[styles.fill, { width, height }]} />
      </GestureDetector>
      <DragLoupe
        isVisible={said != null}
        touchX={touchX}
        touchY={touchY}
        bounds={{ width, height }}
        value={said?.value ?? ''}
        caption={said?.caption}
        midi={said?.midi}
      />
    </>
  );
}

export default GraphSurface;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 }
});
