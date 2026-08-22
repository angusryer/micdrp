/**
 * useBarLineDrag — the shared values and the gesture behind moving or
 * discarding a bar line.
 *
 * Split from the view so that file renders and this one holds the motion.
 * Everything that moves lives in a shared value driven on the UI thread: a
 * drag rendered through React would lag the thumb it is meant to be under
 * (INV-NOTES-045).
 */
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

import {
  AXIS_AWAY,
  AXIS_MOVE,
  AXIS_NONE,
  chooseAxis,
  shouldDiscard
} from './barDragAxis';

/**
 * How long a line must be held before it is picked up.
 *
 * Long enough that a swipe along the take or a pinch beginning on a line is
 * plainly not a hold, short enough that picking one up deliberately does not
 * feel like waiting.
 */
export const PICK_UP_MS = 220;

/**
 * How far up a held line must be carried before releasing it takes it away.
 *
 * Far enough that a sideways drag which wanders vertically does not delete a
 * bar line by accident.
 */
export const SLIDE_AWAY_PX = 56;

/**
 * Upward speed, in points per second, that discards a line on its own.
 *
 * A flick is over before it has travelled far, so speed has to count as well
 * as distance — otherwise a quick throw would simply snap back.
 */
export const FLICK_VELOCITY = 900;

/** How long the line takes to leave once it has been let go. */
const THROW_MS = 170;

export interface BarLineDragOptions {
  lineIndex: number;
  /** How far the line is thrown before it is taken out. */
  throwDistance: number;
  onDrag: (lineIndex: number, x: number, y: number, axis: number, armed: number) => void;
  onDrop: (lineIndex: number, x: number) => void;
  onRemove: (lineIndex: number) => void;
}

export function useBarLineDrag({
  lineIndex,
  throwDistance,
  onDrag,
  onDrop,
  onRemove
}: BarLineDragOptions) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const axis = useSharedValue(AXIS_NONE);
  /** 1 once letting go would discard this line. */
  const armed = useSharedValue(0);
  const leaving = useSharedValue(0);

  const pan = Gesture.Pan()
    .withTestId(`bar-line-pan-${lineIndex}`)
    .activateAfterLongPress(PICK_UP_MS)
    .onBegin(() => {
      tx.value = 0;
      ty.value = 0;
      axis.value = AXIS_NONE;
      armed.value = 0;
      leaving.value = 0;
    })
    .onUpdate((e) => {
      axis.value = chooseAxis(axis.value, e.translationX, e.translationY);
      if (axis.value === AXIS_MOVE) {
        tx.value = e.translationX;
        ty.value = 0;
      } else if (axis.value === AXIS_AWAY) {
        // Upward only: dragging back down past the start just returns it.
        tx.value = 0;
        ty.value = Math.min(0, e.translationY);
        armed.value = ty.value <= -SLIDE_AWAY_PX ? 1 : 0;
      }
      runOnJS(onDrag)(lineIndex, e.absoluteX, e.absoluteY, axis.value, armed.value);
    })
    .onEnd((e) => {
      if (shouldDiscard(axis.value, armed.value, e.velocityY, FLICK_VELOCITY)) {
        leaving.value = 1;
        // Thrown clear, then removed — so the line is seen to go rather than
        // simply blinking out from under the finger.
        ty.value = withTiming(-throwDistance, { duration: THROW_MS }, () => {
          runOnJS(onRemove)(lineIndex);
        });
        return;
      }
      const releasedAt = e.absoluteX;
      tx.value = 0;
      ty.value = 0;
      axis.value = AXIS_NONE;
      armed.value = 0;
      runOnJS(onDrop)(lineIndex, releasedAt);
    });

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: leaving.value ? 0.35 : 1
  }));
  const danger = useAnimatedStyle(() => ({ opacity: armed.value ? 1 : 0 }));

  return { pan, moving, danger };
}
