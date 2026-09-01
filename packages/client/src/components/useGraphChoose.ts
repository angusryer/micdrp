/**
 * Tap to choose, hold to add — and hold on nothing to put a bar there.
 *
 * The two gestures that only ever change what is in hand, kept together
 * because the rule that separates them is one rule: a tap replaces the
 * selection, a hold grows it (INV-NOTES-092, INV-NOTES-093).
 */
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import { isChosen, isSame, toggleChosen } from './graphSelection';
import { foundAt, stepAtX, type SettledOptions } from './graphGestureOptions';

/**
 * Where a press stops being a tap and becomes a hold, in ms (INV-NOTES-192).
 *
 * One number for both, so no press can fall between them. They were 300 and
 * 400, and a press released in between did nothing at all — not on a note,
 * not on a line, not on empty space. Nothing reported it, so it read as the
 * app having missed the press.
 */
const HOLD_FROM_MS = 400;

export function useGraphChoose(o: SettledOptions) {
  const { onSelect, onAddBar, originX, stepWidth, selection } = o;

  const choose = useCallback(
    (x: number, y: number) => {
      const found = foundAt(o, x, y);
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
    [o, onSelect, selection]
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
      const found = foundAt(o, x, y);
      if (!found) {
        return false;
      }
      tapped();
      onSelect(toggleChosen(selection, found));
      return true;
    },
    [o, onSelect, selection]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId('graph-select')
        .maxDuration(HOLD_FROM_MS)
        .onEnd((e) => choose(e.x, e.y))
        .runOnJS(true),
    [choose]
  );

  // Holding empty space puts a downbeat there. It cannot be a tap, which
  // already means "choose", and there is nothing to choose where it lands.
  const add = useMemo(
    () =>
      Gesture.LongPress()
        .withTestId('graph-add-bar')
        .minDuration(HOLD_FROM_MS)
        .onStart((e) => {
          // On something: add it to the set. On nothing: put a downbeat
          // there. One gesture, and what is under it decides — holding empty
          // space could never have meant "also choose this".
          if (alsoChoose(e.x, e.y)) {
            return;
          }
          tapped();
          onAddBar(stepAtX(e.x, originX, stepWidth));
        })
        .runOnJS(true),
    [alsoChoose, onAddBar, originX, stepWidth]
  );

  return { tap, add };
}
