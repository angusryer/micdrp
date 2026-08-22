/**
 * barDragAxis — which way a bar-line drag is going, and whether letting go
 * discards it.
 *
 * Both run on the UI thread inside the gesture, so both carry the `worklet`
 * directive: an ordinary function called from there is a hard crash
 * (INV-NOTES-042). Marked this way they are also plain functions on the
 * JavaScript side, which is what makes the decision testable at all.
 */

/** Neither axis chosen yet, sideways, or upward. */
export const AXIS_NONE = 0;
export const AXIS_MOVE = 1;
export const AXIS_AWAY = 2;

/** Movement before a drag is treated as having a direction at all. */
export const AXIS_DEADZONE = 8;

/**
 * The direction this drag has committed to.
 *
 * Once chosen it is kept (INV-NOTES-046): the two directions mean entirely
 * different things — where a line goes, or whether it exists at all — and a
 * thumb travelling sideways rises and falls by tens of pixels without being
 * asked to. None of that drift should read as an instruction to delete.
 *
 * A tie goes to sideways, which is the reversible one.
 */
export function chooseAxis(current: number, dx: number, dy: number): number {
  'worklet';
  if (current !== AXIS_NONE) {
    return current;
  }
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax <= AXIS_DEADZONE && ay <= AXIS_DEADZONE) {
    return AXIS_NONE;
  }
  return ax >= ay ? AXIS_MOVE : AXIS_AWAY;
}

/**
 * Whether releasing now takes the line away.
 *
 * Distance or speed, either alone. A flick is over before it has travelled
 * far, so speed has to count; and honouring only speed would leave a
 * careful, slow removal failing after the line had already reddened and said
 * it was going (INT-NOTES-014).
 */
export function shouldDiscard(
  axis: number,
  armed: number,
  velocityY: number,
  flickVelocity: number
): boolean {
  'worklet';
  if (axis !== AXIS_AWAY) {
    return false;
  }
  return armed === 1 || velocityY <= -flickVelocity;
}
