/**
 * The crosshatch drawn behind the pickup — the part of the recording before
 * the singing starts.
 *
 * A single line already marks where the take begins (INV-NOTES-080), which
 * says where the boundary is but nothing about which side of it is which. The
 * hatch says the region itself is different in kind: there is recording here
 * but nothing was sung, so there are no notes to be missing and nothing to
 * correct (INV-NOTES-107).
 *
 * Written straight into the path. A long pickup at a close zoom is a couple
 * of hundred diagonals, and handing back an array of segments for something
 * else to loop over would allocate that many objects on every layout change
 * to draw the faintest thing on the screen.
 */
import type { SkPath } from '@shopify/react-native-skia';

/** How far apart the lines run. Wide enough that the region reads as texture. */
export const HATCH_SPACING = 12;

/**
 * Diagonals at both slopes across a box, each clipped to it.
 *
 * Intercepts are placed on a fixed grid rather than relative to the box, so
 * the pattern stays still while the box changes size around it — a hatch that
 * slid as the graph zoomed would read as motion rather than as ground.
 */
export function writePickupHatch(
  path: SkPath,
  left: number,
  right: number,
  height: number,
  spacing: number = HATCH_SPACING
): SkPath {
  if (!(right > left) || !(height > 0) || !(spacing > 0)) {
    return path;
  }
  const start = Math.floor((left - height) / spacing) * spacing;
  for (let c = start; c < right + height; c += spacing) {
    // Down to the right: y = x - c.
    const inA = Math.max(left, c);
    const outA = Math.min(right, c + height);
    if (outA > inA) {
      path.moveTo(inA, inA - c);
      path.lineTo(outA, outA - c);
    }
    // Down to the left: y = c - x.
    const inB = Math.max(left, c - height);
    const outB = Math.min(right, c);
    if (outB > inB) {
      path.moveTo(inB, c - inB);
      path.lineTo(outB, c - outB);
    }
  }
  return path;
}
