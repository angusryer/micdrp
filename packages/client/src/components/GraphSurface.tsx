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
import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import type { ChordToneRect } from './chordLayout';
import { snapToStep } from '../screens/Notes/barDragAxis';
import {
  selectionAt,
  touchesSelection,
  type BarHandlePoint,
  type Selection
} from './graphSelection';

/** Pixels of drag that mean one semitone, when a lane is too small to use. */
const MIN_SEMITONE_PX = 12;

export interface GraphSurfaceProps {
  width: number;
  height: number;
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  /** Height of one semitone lane, for turning a drag into pitch. */
  laneHeight: number;
  /** Step zero and step size, for turning a drag into a grid position. */
  originX: number;
  stepWidth: number;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  /** Move a bar line to a grid step. */
  onMoveBar: (lineIndex: number, step: number) => void;
  /** Move one note of one chord by whole semitones. */
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  /** Put a new downbeat at a grid step. */
  onAddBar: (step: number) => void;
}

export function GraphSurface({
  width,
  height,
  tones,
  bars,
  laneHeight,
  originX,
  stepWidth,
  selection,
  onSelect,
  onMoveBar,
  onMoveTone,
  onAddBar
}: GraphSurfaceProps): React.JSX.Element {
  /** How far the current drag has already been committed. */
  const applied = useRef(0);

  const semitonePx = Math.max(MIN_SEMITONE_PX, laneHeight);

  const stepAt = useCallback(
    (x: number) => (stepWidth > 0 ? Math.round((x - originX) / stepWidth) : 0),
    [originX, stepWidth]
  );

  const choose = useCallback(
    (x: number, y: number) => {
      const found = selectionAt(x, y, tones, bars);
      if (found) {
        tapped();
      }
      onSelect(found);
    },
    [bars, onSelect, tones]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId('graph-select')
        .maxDuration(300)
        .onEnd((e) => choose(e.x, e.y))
        .runOnJS(true),
    [choose]
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('graph-drag')
        // Decided rather than guessed: this claims the touch only when it
        // lands on the thing already chosen. Everything else is refused, and
        // the scroll view underneath gets it.
        .manualActivation(true)
        .onTouchesDown((e, state) => {
          const touch = e.changedTouches[0];
          applied.current = 0;
          if (touch && touchesSelection(selection, touch.x, touch.y, tones, bars)) {
            state.activate();
          } else {
            state.fail();
          }
        })
        .onUpdate((e) => {
          if (!selection) {
            return;
          }
          if (selection.kind === 'chordTone') {
            // Whole semitones only, each emitted once as it is crossed: a
            // note between two pitches is not a note.
            const wanted = Math.round(-e.translationY / semitonePx);
            const step = wanted - applied.current;
            if (step !== 0) {
              applied.current = wanted;
              onMoveTone(selection.slot, selection.tone, step);
            }
            return;
          }
          const line = bars.find((b) => b.lineIndex === selection.lineIndex);
          if (!line) {
            return;
          }
          const step = stepAt(snapToStep(line.x + e.translationX, originX, stepWidth));
          if (step !== applied.current) {
            applied.current = step;
            onMoveBar(selection.lineIndex, step);
          }
        })
        .runOnJS(true),
    [bars, onMoveBar, onMoveTone, originX, selection, semitonePx, stepAt, stepWidth, tones]
  );

  // Holding empty space puts a downbeat there. It cannot be a tap, which
  // already means "choose", and there is nothing to choose where it lands.
  const add = useMemo(
    () =>
      Gesture.LongPress()
        .withTestId('graph-add-bar')
        .minDuration(400)
        .onStart((e) => {
          if (selectionAt(e.x, e.y, tones, bars)) {
            return;
          }
          tapped();
          onAddBar(stepAt(e.x));
        })
        .runOnJS(true),
    [bars, onAddBar, stepAt, tones]
  );

  const gesture = useMemo(
    () => Gesture.Race(drag, Gesture.Exclusive(add, tap)),
    [add, drag, tap]
  );

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
