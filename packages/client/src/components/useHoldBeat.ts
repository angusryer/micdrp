/**
 * Hold a beat, then move it (INV-NOTES-163).
 *
 * The graph lives inside a page that scrolls, so a vertical drag is ambiguous
 * — the page wants it and so does the beat. Holding first says which was
 * meant, and spends none of the horizontal direction that placing a bar line
 * already uses.
 *
 * It picks the beat up whether or not it was chosen first: a hold on a beat
 * cannot have meant anything else, and asking for a tap before it would be two
 * gestures for one intention.
 */
import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import { isChosen } from './graphSelection';
import { foundAt, type SettledOptions } from './graphGestureOptions';

/**
 * How long a beat must be held before a drag picks it up, in ms.
 *
 * Long enough not to fire while the page is being scrolled past, short enough
 * that it does not feel like waiting. Under the 400ms that means "add", so a
 * hold on a beat resolves before the other reading can.
 */
const HOLD_TO_DRAG_MS = 220;

export function useHoldBeat(o: SettledOptions) {
  const { onMoveBeat, onSelect, selection } = o;
  /** Which beat a hold picked up, or null when none is being carried. */
  const held = useRef<number | null>(null);

  return useMemo(
    () =>
      Gesture.Pan()
        .withTestId('graph-hold-beat')
        .activateAfterLongPress(HOLD_TO_DRAG_MS)
        // Refused at once when this hold means something else, so the touch
        // reaches the longer hold underneath rather than being swallowed
        // here at 220ms.
        .onTouchesDown((e, state) => {
          const touch = e.changedTouches[0];
          const beat = touch && foundAt(o, touch.x, touch.y);
          if (beat?.kind !== 'beat') {
            state.fail();
            return;
          }
          // With a set already in hand and this beat not in it, the hold is
          // still the one that grows the set (INV-NOTES-093). Carrying it off
          // instead would make a set of beats impossible to build.
          if (selection.length > 0 && !isChosen(selection, beat)) {
            state.fail();
            return;
          }
          held.current = beat.index;
        })
        .onStart(() => {
          if (held.current == null) {
            return;
          }
          // Said the moment it is picked up rather than when it lands: the
          // hold is otherwise silent, and a beat that starts moving without
          // warning reads as a misplaced tap.
          tapped();
          onSelect([{ kind: 'beat', index: held.current }]);
        })
        .onUpdate((e) => {
          if (held.current == null) {
            return;
          }
          // Straight to the finger. There is nothing to snap to yet: the grid
          // is being taken out of the app's hands and put into the singer's
          // (INV-NOTES-161).
          onMoveBeat?.(held.current, e.x);
        })
        .onFinalize(() => {
          held.current = null;
        })
        .runOnJS(true),
    [o, onMoveBeat, onSelect, selection]
  );
}
