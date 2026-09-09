/**
 * How far a finger has taken a control from where its committed value puts
 * it (INV-NOTES-235).
 *
 * A control that follows a finger is drawn as a base plus an offset: the base
 * is the committed value and comes from a render, the offset is the drag and
 * lives on the UI thread. That earns the first paint — the base alone is
 * already right, so nothing has to wait for an effect to learn where it is.
 *
 * The awkward part is the release, and it is why this is a pair of values
 * rather than one. The drag settles at `base + offset` and the commit makes
 * that the new base, so the offset must stop counting at exactly the render
 * the new base arrives on. Putting it back to nothing in an effect is one
 * render too late: for that frame the style reads the new base and the old
 * offset and draws the control a whole drag further on, then snaps back.
 *
 * So the offset says which base it was measured from, and is worth nothing
 * against any other. No effect, no ordering to get right, and no frame drawn
 * anywhere the finger never was.
 */
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export interface DragOffset {
  /** How far from the base, in the base's own units. */
  by: SharedValue<number>;
  /** The base it was measured from. Nothing else may use it. */
  from: SharedValue<number>;
}

export function useDragOffset(): DragOffset {
  return {
    by: useSharedValue(0),
    // Not a number any base will be: an offset of zero from an unseen base is
    // still zero, but this way the first frame cannot match by accident.
    from: useSharedValue(Number.NaN)
  };
}

/** What the offset is worth against this base — nothing, once it has moved. */
export function offsetFrom(offset: DragOffset, base: number): number {
  'worklet';
  return offset.from.value === base ? offset.by.value : 0;
}

/** Take the offset to a place, and say which base that place was measured from. */
export function moveOffset(
  offset: DragOffset,
  base: number,
  to: number
): void {
  'worklet';
  offset.by.value = to;
  offset.from.value = base;
}
