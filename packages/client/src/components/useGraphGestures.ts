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
import { isFlickAway, throwAway } from './flickAway';
import type { ChordToneRect } from './chordLayout';
import type { NoteRect } from './melodyLayout';
import { snapToStep } from '../screens/Notes/barDragAxis';
import { midiToLabel } from '../screens/Results/NoteList';
import {
  isChosen,
  isSame,
  selectionAt,
  toggleChosen,
  touchesSelection,
  type BarHandlePoint,
  type BeatLine,
  type Chosen,
  type HitPoint,
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
  /** The layer's notes (INV-NOTES-118). */
  layerNotes?: readonly NoteRect[];
  /** Where each struck sound's mark sits (INV-NOTES-118). */
  hits?: readonly HitPoint[];
  /** Where each tapped beat is drawn (INV-NOTES-130). */
  beats?: readonly BeatLine[];
  laneHeight: number;
  originX: number;
  stepWidth: number;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  onMoveBar: (lineIndex: number, step: number) => void;
  /**
   * Move a tapped beat to a pixel position (INV-NOTES-130).
   *
   * In pixels rather than steps: a tapped beat is not on the grid — it is
   * what the grid is derived from — so snapping it to one would be the
   * reading correcting the statement it came from.
   */
  onMoveBeat?: (index: number, x: number) => void;
  /**
   * Throw a vertical line away — flicked across rather than along
   * (INV-NOTES-132). One call per line, so a set flicked together all goes.
   */
  onRemoveBar?: (lineIndex: number) => void;
  onRemoveBeat?: (index: number) => void;
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  onMoveNote: (index: number, semitones: number) => void;
  onAddBar: (step: number) => void;
  /**
   * The pitch the finger has just reached, once per semitone crossed. What
   * makes a drag its own audition (INV-NOTES-070).
   */
  onHear?: (midi: number) => void;
  /**
   * What is under the thumb while one thing is being dragged, or null when
   * nothing is. A person cannot judge a placement they are covering with
   * their own hand (INV-NOTES-025).
   */
  onPreview?: (preview: DragPreview | null) => void;
}

/** The readout that follows a drag: where the finger is, and what it means. */
export interface DragPreview {
  x: number;
  y: number;
  /** The pitch it would become, named. */
  value: string;
  /** And as a number, so the loupe can draw it in its lane (INV-NOTES-110). */
  midi: number;
  /** How far it has come, so a small move is legible as a small move. */
  caption: string;
}

export function useGraphGestures({
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
  onHear,
  onPreview
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
      const found = selectionAt(x, y, tones, bars, notes, layerNotes, hits, beats);
      if (found) {
        tapped();
      }
      if (!found) {
        onSelect([]);
        return;
      }
      // A tap toggles the thing under it (INV-NOTES-092): already chosen and
      // it is put down, however many others are in hand; not chosen and it
      // becomes the whole selection. Hold is what adds to a set, which is
      // what keeps the two gestures distinct (INV-NOTES-093).
      onSelect(
        isChosen(selection, found)
          ? selection.filter((one) => !isSame(one, found))
          : [found]
      );
    },
    [bars, notes, onSelect, tones, selection]
  );

  /**
   * Hold an object to add it to the set, or take it back out.
   *
   * Only once something is already chosen. Holding is how a set is grown, and
   * a set of one is where growing starts — with nothing chosen there is
   * nothing to add to, and the hold means what it always meant
   * (INV-NOTES-093).
   */
  const alsoChoose = useCallback(
    (x: number, y: number) => {
      if (selection.length === 0) {
        return false;
      }
      const found = selectionAt(x, y, tones, bars, notes, layerNotes, hits, beats);
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
              touchesSelection(
                one,
                touch.x,
                touch.y,
                tones,
                bars,
                notes,
                layerNotes,
                hits,
                beats
              )
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
            // Only for one thing. With a set in hand there is no single note
            // to name, and a readout claiming one would name the wrong one.
            if (selection.length === 1 && grabbedMidi.current != null) {
              onPreview?.({
                x: e.x,
                y: e.y,
                midi: grabbedMidi.current + wanted,
                value: midiToLabel(grabbedMidi.current + wanted),
                caption:
                  wanted === 0
                    ? 'where it was'
                    : `${wanted > 0 ? '+' : ''}${wanted} semitone${
                        Math.abs(wanted) === 1 ? '' : 's'
                      }`
              });
            }
            return;
          }
          if (kind === 'beat') {
            // Straight to where the finger is. A tapped beat is what the grid
            // is derived from, so there is no grid to snap it to.
            for (const one of selection) {
              if (one.kind === 'beat') {
                onMoveBeat?.(one.index, e.x);
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
        // A flick across a line throws it away (INV-NOTES-132). Read at the
        // end rather than during: what makes it a flick is where it finished
        // and how fast it was still going, neither of which is known while
        // the finger is still down.
        .onEnd((e) => {
          if (!isFlickAway(e)) {
            return;
          }
          if (throwAway(selection, onRemoveBar, onRemoveBeat) === 0) {
            return;
          }
          tapped();
          onSelect([]);
        })
        .onFinalize(() => onPreview?.(null))
        .runOnJS(true),
    [
      bars,
      notes,
      onHear,
      onPreview,
      onMoveBar,
      onMoveBeat,
      onRemoveBar,
      onRemoveBeat,
      onMoveNote,
      onMoveTone,
      onSelect,
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
