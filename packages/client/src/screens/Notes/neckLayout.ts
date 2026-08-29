/**
 * Where the parts of a drawn neck go. Pure arithmetic, unit-tested; the
 * component only paints what this returns (INV-NOTES-145).
 *
 * The frets narrow toward the body rather than dividing the width evenly.
 * That single detail is most of what makes the picture read as a fretboard
 * instead of a spreadsheet, and it costs one line: a fret sits at the point
 * where the remaining string is shortened by the twelfth root of two, which
 * is why the twelfth fret lands at exactly half the scale.
 */

/** Single markers here, and a doubled one at the twelfth (INV-NOTES-145). */
export const MARKER_FRETS: readonly number[] = [3, 5, 7, 9];
export const DOUBLE_MARKER_FRET = 12;

/** Every marked fret, in order — the ones that get a number (INV-NOTES-153). */
export const NUMBERED_FRETS: readonly number[] = [
  ...MARKER_FRETS,
  DOUBLE_MARKER_FRET
];

/** Room left of the nut for the open-string dots (INV-NOTES-148). */
const OPEN_GUTTER = 22;

/**
 * How tall the board is drawn: the smallest height at which six strings are
 * still separately readable, the graph above having taken half the screen.
 */
export const NECK_HEIGHT = 116;

export interface NeckGeometry {
  /** Where the nut stands. Everything fretted is to the right of it. */
  nutX: number;
  /** x of each fret wire, `frets + 1` of them counting the nut at index 0. */
  fretXs: readonly number[];
  /** y of each string, indexed by sounding order — lowest string first. */
  stringYs: readonly number[];
  /** How thick each string is drawn, same indexing as `stringYs`. */
  stringWidths: readonly number[];
  /** The middle of a fret's space; fret 0 is the open dot's gutter. */
  centreOf: (fret: number) => number;
}

export interface NeckLayoutOptions {
  width: number;
  height: number;
  strings: number;
  frets: number;
}

/**
 * The neck laid out in the box it was given.
 *
 * Tab orientation, so the highest-sounding string is the top line and the
 * lowest the bottom one (INV-NOTES-148). `stringYs` is indexed the way the
 * tuning is — lowest string first — so the flip lives here and nothing that
 * reasons about pitch has to know about it.
 */
export function layoutNeck({
  width,
  height,
  strings,
  frets
}: NeckLayoutOptions): NeckGeometry {
  const nutX = OPEN_GUTTER;
  // The nut-to-body span the frets divide up. The twelfth fret halves the
  // string, so a neck drawn to the twelfth is half of a whole scale length.
  const scale = Math.max(0, width - nutX) * 2;
  const fretXs: number[] = [];
  for (let fret = 0; fret <= frets; fret += 1) {
    fretXs.push(nutX + scale * (1 - Math.pow(2, -fret / 12)));
  }

  // Even spacing, with half a gap of air above the top string and below the
  // bottom one, so the outer strings do not sit on the edge of the board.
  const gap = strings > 0 ? height / strings : 0;
  const stringYs: number[] = [];
  const stringWidths: number[] = [];
  for (let string = 0; string < strings; string += 1) {
    // Lowest-sounding string at the bottom of the drawing.
    stringYs.push(height - gap * (string + 0.5));
    // Thicker as they get lower, which is how a neck is recognised from
    // across a room and how you know which line is which without counting.
    stringWidths.push(1 + (1.6 * (strings - 1 - string)) / Math.max(1, strings - 1));
  }

  return {
    nutX,
    fretXs,
    stringYs,
    stringWidths,
    centreOf: (fret: number) =>
      fret <= 0
        ? nutX / 2
        : (fretXs[Math.min(fret, frets) - 1] + fretXs[Math.min(fret, frets)]) / 2
  };
}
