/**
 * useBarLineDrag — the shared values and the gesture behind moving or
 * discarding a bar line.
 *
 * Everything that moves lives in a shared value driven on the UI thread: a
 * drag rendered through React would lag the thumb it is meant to be under
 * (INV-NOTES-045).
 *
 * All of it works in the graph's own coordinates, never the screen's. The
 * line's position, the step it will land on and the readout that reports it
 * are then one number rather than three that have to be kept in agreement —
 * and a graph that is inset and scrolled makes screen coordinates a
 * different space entirely (INV-NOTES-034).
 */
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

import { tapped } from '../../utilities/haptics';
import {
  AXIS_AWAY,
  AXIS_MOVE,
  AXIS_NONE,
  chooseAxis,
  shouldDiscard,
  snapToStep
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
  /** Where this line sits in the graph's own coordinates. */
  handleX: number;
  /** The graph's step-zero position and step size, both in those coordinates. */
  originX: number;
  stepWidth: number;
  /** How far the line is thrown before it is taken out. */
  throwDistance: number;
  onDrag: (lineIndex: number, x: number, y: number, axis: number, armed: number) => void;
  onDrop: (lineIndex: number, x: number) => void;
  onRemove: (lineIndex: number) => void;
}

export function useBarLineDrag({
  lineIndex,
  handleX,
  originX,
  stepWidth,
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
  /** 1 while the line is picked up, which is what the glow reads. */
  const held = useSharedValue(0);

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
    // Fires once the hold has been earned, which is the moment the line is
    // in hand and the moment worth announcing.
    .onStart(() => {
      held.value = 1;
      // Felt at the moment the line is in hand, so the hold does not have to
      // be counted out. Absent on a binary without the module, which is
      // normal for a bundle that arrived over the air.
      runOnJS(tapped)();
    })
    .onUpdate((e) => {
      axis.value = chooseAxis(axis.value, e.translationX, e.translationY);
      let contentX = handleX;
      if (axis.value === AXIS_MOVE) {
        // Snapped as it moves, not only when released: the line lands on
        // steps, so showing it anywhere else is showing something that will
        // not happen (INV-NOTES-047).
        contentX = snapToStep(handleX + e.translationX, originX, stepWidth);
        tx.value = contentX - handleX;
        ty.value = 0;
      } else if (axis.value === AXIS_AWAY) {
        // Upward only: dragging back down past the start just returns it.
        tx.value = 0;
        ty.value = Math.min(0, e.translationY);
        armed.value = ty.value <= -SLIDE_AWAY_PX ? 1 : 0;
      }
      runOnJS(onDrag)(lineIndex, contentX, e.y, axis.value, armed.value);
    })
    .onEnd((e) => {
      held.value = 0;
      if (shouldDiscard(axis.value, armed.value, e.velocityY, FLICK_VELOCITY)) {
        leaving.value = 1;
        // Thrown clear, then removed — so the line is seen to go rather than
        // simply blinking out from under the finger.
        ty.value = withTiming(-throwDistance, { duration: THROW_MS }, () => {
          runOnJS(onRemove)(lineIndex);
        });
        return;
      }
      // Where it was actually left, in the graph's coordinates — the same
      // number the line was drawn at, so the two cannot disagree.
      const releasedAt = handleX + tx.value;
      tx.value = 0;
      ty.value = 0;
      axis.value = AXIS_NONE;
      armed.value = 0;
      runOnJS(onDrop)(lineIndex, releasedAt);
    })
    .onFinalize(() => {
      held.value = 0;
    });

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: leaving.value ? 0.35 : 1
  }));
  const danger = useAnimatedStyle(() => ({ opacity: armed.value ? 1 : 0 }));
  const glow = useAnimatedStyle(() => ({ opacity: held.value ? 1 : 0 }));

  return { pan, moving, danger, glow };
}
