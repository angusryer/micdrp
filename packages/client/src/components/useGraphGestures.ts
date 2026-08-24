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
  isChosen,
  selectionAt,
  toggleChosen,
  touchesSelection,
  type BarHandlePoint,
  type Chosen,
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
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
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
   * Where each chosen thing was when the finger went down.
   *
   * A translation is cumulative from touch-down, so it can only be added to a
   * position that has not itself moved since. Adding it to where a line is
   * *now* — which the commit below has already moved — counts every pixel
   * twice, then three times, and the line outruns the thumb (INV-NOTES-056).
   */
  /** The pitch of the thing being dragged when the finger went down. */
  const grabbedMidi = useRef<number | null>(null);
  /** Where each chosen bar line sat when the finger went down. */
  const grabbedBars = useRef<{ lineIndex: number; x: number }[]>([]);

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
      if (!found) {
        onSelect([]);
        return;
      }
      // A tap always means "this one alone" — putting it down when it was
      // the only thing chosen (INV-NOTES-092), and collapsing a set to it
      // otherwise. Keeping one meaning for tap is what lets hold mean
      // something else (INV-NOTES-093).
      const only = selection.length === 1 && isChosen(selection, found);
      onSelect(only ? [] : [found]);
    },
    [bars, notes, onSelect, tones, selection]
  );

  /** Hold an object to add it to the set, or take it back out. */
  const alsoChoose = useCallback(
    (x: number, y: number) => {
      const found = selectionAt(x, y, tones, bars, notes);
      if (!found) {
        return false;
      }
      tapped();
      onSelect(toggleChosen(selection, found));
      return true;
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
          const grabbed =
            touch &&
            selection.find((one) =>
              touchesSelection(one, touch.x, touch.y, tones, bars, notes)
            );
          if (!grabbed) {
            state.fail();
            return;
          }
          // The pitch of the one actually under the finger, so the audition
          // follows the thumb rather than whichever was chosen first.
          grabbedMidi.current = pitchOf(grabbed, tones, notes);
          if (grabbed.kind === 'barLine') {
            // Every chosen line's starting place, so they all move by the
            // same amount and keep their spacing (INV-NOTES-056).
            grabbedBars.current = selection.flatMap((one) =>
              one.kind === 'barLine'
                ? [
                    {
                      lineIndex: one.lineIndex,
                      x: bars.find((b) => b.lineIndex === one.lineIndex)?.x ?? 0
                    }
                  ]
                : []
            );
            applied.current = 0;
          }
          state.activate();
        })
        .onUpdate((e) => {
          if (selection.length === 0) {
            return;
          }
          const kind = selection[0].kind;
          if (kind === 'chordTone' || kind === 'melodyNote') {
            // Whole semitones only, each emitted once as it is crossed: a
            // note between two pitches is not a note. Everything chosen moves
            // by the same amount, so the shape of a phrase survives being
            // moved as one (INV-NOTES-093).
            const wanted = Math.round(-e.translationY / semitonePx);
            const step = wanted - applied.current;
            if (step !== 0) {
              applied.current = wanted;
              for (const one of selection) {
                if (one.kind === 'chordTone') {
                  onMoveTone(one.slot, one.tone, step);
                } else if (one.kind === 'melodyNote') {
                  onMoveNote(one.index, step);
                }
              }
              // Read from where the thing started rather than from where it
              // is now — the same reason the bar drag anchors.
              if (grabbedMidi.current != null) {
                onHear?.(grabbedMidi.current + wanted);
              }
            }
            return;
          }
          // Bars: every chosen line moves by the same number of steps, read
          // from where each began.
          const moved = stepAt(
            snapToStep(
              (grabbedBars.current[0]?.x ?? 0) + e.translationX,
              originX,
              stepWidth
            )
          );
          const delta = moved - stepAt(grabbedBars.current[0]?.x ?? 0);
          if (delta !== applied.current) {
            applied.current = delta;
            for (const line of grabbedBars.current) {
              onMoveBar(line.lineIndex, stepAt(line.x) + delta);
            }
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
          // On something: add it to the set. On nothing: put a downbeat
          // there. One gesture, and what is under it decides — holding empty
          // space could never have meant "also choose this".
          if (alsoChoose(e.x, e.y)) {
            return;
          }
          tapped();
          onAddBar(stepAt(e.x));
        })
        .runOnJS(true),
    [alsoChoose, onAddBar, stepAt]
  );

  return useMemo(
    () => Gesture.Race(drag, Gesture.Exclusive(add, tap)),
    [add, drag, tap]
  );
}
