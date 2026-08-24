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
 * Segments rather than a drawing, so the geometry can be checked without a
 * canvas — the thing that goes wrong with a hatch is a line escaping its
 * region, and that is arithmetic.
 */

/** How far apart the lines run. Wide enough that the region reads as texture. */
export const HATCH_SPACING = 12;

export interface HatchSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Diagonals at both slopes across a box, each clipped to it.
 *
 * Intercepts are placed on a fixed grid rather than relative to the box, so
 * the pattern stays still while the box changes size around it — a hatch that
 * slid as the graph zoomed would read as motion rather than as ground.
 */
export function hatchSegments(
  left: number,
  right: number,
  height: number,
  spacing: number = HATCH_SPACING
): HatchSegment[] {
  if (!(right > left) || !(height > 0) || !(spacing > 0)) {
    return [];
  }
  const segments: HatchSegment[] = [];
  const start = Math.floor((left - height) / spacing) * spacing;
  for (let c = start; c < right + height; c += spacing) {
    // Down to the right: y = x - c.
    const inA = Math.max(left, c);
    const outA = Math.min(right, c + height);
    if (outA > inA) {
      segments.push({ x1: inA, y1: inA - c, x2: outA, y2: outA - c });
    }
    // Down to the left: y = c - x.
    const inB = Math.max(left, c - height);
    const outB = Math.min(right, c);
    if (outB > inB) {
      segments.push({ x1: inB, y1: c - inB, x2: outB, y2: c - outB });
    }
  }
  return segments;
}
