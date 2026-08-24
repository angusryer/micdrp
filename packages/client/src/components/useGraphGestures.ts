/**
 * useGraphGestures — reading a touch on the graph as choose, move, or add.
 *
 * Split from the surface so that file composes and this decides. Every one of
 * these runs on the JavaScript side: what they need — which object is under a
 * point, what a chord is called — is ordinary code, and calling ordinary code
 * from the UI thread is a hard crash (INV-NOTES-042).
 */
import { useCallback, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import { snapToStep } from '../screens/Notes/barDragAxis';
import {
  isSame,
  selectionAt,
  touchesSelection,
  type BarHandlePoint,
  type Selection
} from './graphSelection';

/** Pixels of drag that mean one semitone, when a lane is too small to use. */
const MIN_SEMITONE_PX = 12;

/** What the chosen thing sounds at, or null for something with no pitch. */
function pitchOf(
  selection: Selection | null,
  tones: readonly ChordToneRect[],
  notes: readonly NoteRect[]
): number | null {
  if (selection?.kind === 'chordTone') {
    return (
      tones.find(
        (t) => t.slot === selection.slot && t.tone === selection.tone
      )?.midi ?? null
    );
  }
  if (selection?.kind === 'melodyNote') {
    return notes[selection.index]?.midi ?? null;
  }
  return null;
}

export interface GraphGestureOptions {
  tones: readonly ChordToneRect[];
  bars: readonly BarHandlePoint[];
  notes: readonly NoteRect[];
  laneHeight: number;
  originX: number;
  stepWidth: number;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onMoveBar: (lineIndex: number, step: number) => void;
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  onMoveNote: (index: number, semitones: number) => void;
  onAddBar: (step: number) => void;
  /**
   * The pitch the finger has just reached, once per semitone crossed. What
   * makes a drag its own audition (INV-NOTES-070).
   */
  onHear?: (midi: number) => void;
}

export function useGraphGestures({
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
}: GraphGestureOptions) {
  /** How far the current drag has already been committed. */
  const applied = useRef(0);
  /**
   * Where the thing being dragged was when the finger went down.
   *
   * A translation is cumulative from touch-down, so it can only be added to a
   * position that has not itself moved since. Adding it to where the line is
   * *now* — which the commit below has already moved — counts every pixel
   * twice, then three times, and the line outruns the thumb (INV-NOTES-056).
   */
  const grabX = useRef(0);
  /** The pitch of the thing being dragged when the finger went down. */
  const grabbedMidi = useRef<number | null>(null);

  const semitonePx = Math.max(MIN_SEMITONE_PX, laneHeight);

  const stepAt = useCallback(
    (x: number) => (stepWidth > 0 ? Math.round((x - originX) / stepWidth) : 0),
    [originX, stepWidth]
  );

  const choose = useCallback(
    (x: number, y: number) => {
      const found = selectionAt(x, y, tones, bars, notes);
      if (found) {
        tapped();
      }
      // Tapping the chosen thing again puts it down. The same tap that picked
      // it up is the obvious way to let go of it, and hunting for empty space
      // to tap is a poor substitute on a graph with little of it
      // (INV-NOTES-092).
      onSelect(isSame(found, selection) ? null : found);
    },
    [bars, notes, onSelect, tones, selection]
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
          if (
            touch &&
            touchesSelection(selection, touch.x, touch.y, tones, bars, notes)
          ) {
            grabbedMidi.current = pitchOf(selection, tones, notes);
            if (selection?.kind === 'barLine') {
              const line = bars.find((b) => b.lineIndex === selection.lineIndex);
              grabX.current = line?.x ?? 0;
              // Where it already is, so a drag that goes nowhere commits
              // nothing rather than re-issuing the position it is at.
              applied.current = stepAt(grabX.current);
            }
            state.activate();
          } else {
            state.fail();
          }
        })
        .onUpdate((e) => {
          if (!selection) {
            return;
          }
          if (selection.kind === 'chordTone' || selection.kind === 'melodyNote') {
            // Whole semitones only, each emitted once as it is crossed: a
            // note between two pitches is not a note.
            const wanted = Math.round(-e.translationY / semitonePx);
            const step = wanted - applied.current;
            if (step !== 0) {
              applied.current = wanted;
              if (selection.kind === 'chordTone') {
                onMoveTone(selection.slot, selection.tone, step);
              } else {
                onMoveNote(selection.index, step);
              }
              // The pitch just reached, read from where the thing started
              // rather than from where it is now — the same reason the bar
              // drag anchors (INV-NOTES-056).
              if (grabbedMidi.current != null) {
                onHear?.(grabbedMidi.current + wanted);
              }
            }
            return;
          }
          const step = stepAt(
            snapToStep(grabX.current + e.translationX, originX, stepWidth)
          );
          if (step !== applied.current) {
            applied.current = step;
            onMoveBar(selection.lineIndex, step);
          }
        })
        .runOnJS(true),
    [
      bars,
      notes,
      onHear,
      onMoveBar,
      onMoveNote,
      onMoveTone,
      originX,
      selection,
      semitonePx,
      stepAt,
      stepWidth,
      tones
    ]
  );

  // Holding empty space puts a downbeat there. It cannot be a tap, which
  // already means "choose", and there is nothing to choose where it lands.
  const add = useMemo(
    () =>
      Gesture.LongPress()
        .withTestId('graph-add-bar')
        .minDuration(400)
        .onStart((e) => {
          if (selectionAt(e.x, e.y, tones, bars, notes)) {
            return;
          }
          tapped();
          onAddBar(stepAt(e.x));
        })
        .runOnJS(true),
    [bars, notes, onAddBar, stepAt, tones]
  );

  return useMemo(
    () => Gesture.Race(drag, Gesture.Exclusive(add, tap)),
    [add, drag, tap]
  );
}
