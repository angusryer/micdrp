/**
 * Moving what is already in hand — and flicking it away.
 *
 * Claims the touch only where it lands on something chosen, so everything
 * else falls through to the page underneath, which is still scrolling.
 */
import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import { isFlickAway, throwAway } from './flickAway';
import { touchesSelection } from './graphHitTest';
import { moveBars, moveBeats, movePitched } from './graphDragMove';
import { pitchOf, type SettledOptions } from './graphGestureOptions';

export function useGraphDrag(o: SettledOptions) {
  /**
   * What the drag remembers from touch-down.
   *
   * A translation is cumulative from there, so it can only be added to a
   * position that has not itself moved since. Adding it to where a line is
   * *now* — which the commit has already moved — counts every pixel twice,
   * then three times, and the line outruns the thumb (INV-NOTES-056).
   */
  const memory = {
    applied: useRef(0),
    grabbedMidi: useRef<number | null>(null),
    grabbedBars: useRef<{ lineIndex: number; x: number }[]>([])
  };

  return useMemo(
    () =>
      Gesture.Pan()
        .withTestId('graph-drag')
        // Decided rather than guessed: this claims the touch only when it
        // lands on the thing already chosen. Everything else is refused, and
        // the scroll view underneath gets it.
        .manualActivation(true)
        .onTouchesDown((e, state) => {
          const touch = e.changedTouches[0];
          memory.applied.current = 0;
          const grabbed =
            touch &&
            o.selection.find((one) =>
              touchesSelection(
                one,
                touch.x,
                touch.y,
                o.tones,
                o.bars,
                o.notes,
                o.layerNotes,
                o.hits,
                o.beats
              )
            );
          if (!grabbed) {
            state.fail();
            return;
          }
          // The pitch of the one actually under the finger, so the audition
          // follows the thumb rather than whichever was chosen first.
          memory.grabbedMidi.current = pitchOf(grabbed, o.tones, o.notes);
          if (grabbed.kind === 'barLine') {
            // Every chosen line's starting place, so they all move by the
            // same amount and keep their spacing (INV-NOTES-056).
            memory.grabbedBars.current = o.selection.flatMap((one) =>
              one.kind === 'barLine'
                ? [
                    {
                      lineIndex: one.lineIndex,
                      x:
                        o.bars.find((b) => b.lineIndex === one.lineIndex)?.x ??
                        0
                    }
                  ]
                : []
            );
          }
          state.activate();
        })
        .onUpdate((e) => {
          const kind = o.selection[0]?.kind;
          if (kind === 'chordTone' || kind === 'melodyNote') {
            movePitched(e, o, memory);
          } else if (kind === 'beat') {
            moveBeats(e, o);
          } else if (kind === 'barLine') {
            moveBars(e, o, memory);
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
          if (throwAway(o.selection, o.onRemoveBar, o.onRemoveBeat) === 0) {
            return;
          }
          tapped();
          o.onSelect([]);
        })
        .onFinalize(() => o.onPreview?.(null))
        .runOnJS(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memory is refs
    [o]
  );
}
