/**
 * useGraphGestures — reading a touch on the graph as choose, move, or add.
 *
 * Split from the surface so that file composes and this decides. Every one of
 * these runs on the JavaScript side: what they need — which object is under a
 * point, what a chord is called — is ordinary code, and calling ordinary code
 * from the UI thread is a hard crash (INV-NOTES-042).
 *
 * The readings themselves live one to a file. This one settles the defaults
 * once and says which reading wins when two of them could apply.
 */
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { useGraphChoose } from './useGraphChoose';
import { useGraphDrag } from './useGraphDrag';
import { useHoldBeat } from './useHoldBeat';
import type {
  GraphGestureOptions,
  SettledOptions
} from './graphGestureOptions';

export type { DragPreview, GraphGestureOptions } from './graphGestureOptions';

export function useGraphGestures(options: GraphGestureOptions) {
  const {
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
    snapToGrid = true,
    onHear,
    onPreview
  } = options;

  // One object, held stable, so the gestures below rebuild when the graph
  // changes and not on every render.
  const settled = useMemo<SettledOptions>(
    () => ({
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
      snapToGrid,
      onHear,
      onPreview
    }),
    [
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
      snapToGrid,
      onHear,
      onPreview
    ]
  );

  const { tap, add } = useGraphChoose(settled);
  const drag = useGraphDrag(settled);
  const holdBeat = useHoldBeat(settled);

  // The held beat goes first: a hold that lands on a beat it may carry is
  // never the "add a bar here" hold, and never a tap.
  return useMemo(
    () => Gesture.Race(holdBeat, drag, Gesture.Exclusive(add, tap)),
    [holdBeat, add, drag, tap]
  );
}
