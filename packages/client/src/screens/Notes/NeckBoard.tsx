/**
 * NeckBoard — the neck itself, with nothing on it.
 *
 * Plain lines on a board. The ask was only that it be followable as a
 * fretboard, and a photograph would have to be shipped, licensed, tinted for
 * two palettes and redrawn for every screen width to say the same thing
 * (INV-NOTES-145). Three details do the work: fret spaces that narrow toward
 * the body, strings that thicken as they get lower, and the markers a player
 * counts frets by.
 *
 * Paint only, and static — nothing here moves, so the lit place is a separate
 * layer drawn over it. Skia primitives carry no testID, so what a test reads
 * back is the geometry itself: a string is a horizontal line, a fret wire a
 * vertical one, and an inlay is the smallest circle on the canvas.
 */
import React from 'react';
import { Circle, Group, Line, Rect, vec } from '@shopify/react-native-skia';

import {
  DOUBLE_MARKER_FRET,
  MARKER_FRETS,
  type NeckGeometry
} from './neckLayout';

export interface NeckBoardProps {
  geometry: NeckGeometry;
  width: number;
  height: number;
  colors: {
    /** The wood. */ board: string;
    /** Fret wires and the nut. */ wire: string;
    /** The strings. */ string: string;
    /** Inlays. */ marker: string;
  };
}

/** How far apart the two twelfth-fret inlays sit, as a share of the height. */
const DOUBLE_MARKER_SPREAD = 0.22;

/** Inlays are the smallest thing drawn, which is how a test tells them apart. */
export const MARKER_RADIUS = 3.5;

export function NeckBoard({
  geometry,
  width,
  height,
  colors
}: NeckBoardProps): React.JSX.Element {
  const { fretXs, stringYs, stringWidths, nutX, centreOf } = geometry;
  const lastFret = fretXs.length - 1;

  return (
    <Group>
      {/* The board runs from the nut to the end of the last fret; the gutter
          left of the nut is off the board, which is where an open string is
          played from (INV-NOTES-148). */}
      <Rect
        x={nutX}
        y={0}
        width={Math.max(0, width - nutX)}
        height={height}
        color={colors.board}
      />

      {/* Inlays under the strings, as they are under them on a guitar. */}
      {MARKER_FRETS.map((fret) => (
        <Circle
          key={`marker-${fret}`}
          cx={centreOf(fret)}
          cy={height / 2}
          r={MARKER_RADIUS}
          color={colors.marker}
        />
      ))}
      {[-1, 1].map((side) => (
        <Circle
          key={`marker-12-${side}`}
          cx={centreOf(DOUBLE_MARKER_FRET)}
          cy={height / 2 + side * height * DOUBLE_MARKER_SPREAD}
          r={MARKER_RADIUS}
          color={colors.marker}
        />
      ))}

      {/* The nut is the thick one, and the wires thin out up the neck the way
          the spaces do. */}
      {fretXs.map((x, fret) => (
        <Line
          key={`fret-${fret}`}
          p1={vec(x, 0)}
          p2={vec(x, height)}
          color={colors.wire}
          strokeWidth={fret === 0 ? 4 : fret === lastFret ? 1 : 1.5}
        />
      ))}

      {/* Drawn last so they cross the wires rather than passing under them. */}
      {stringYs.map((y, string) => (
        <Line
          key={`string-${string}`}
          p1={vec(0, y)}
          p2={vec(width, y)}
          color={colors.string}
          strokeWidth={stringWidths[string]}
        />
      ))}
    </Group>
  );
}

export default NeckBoard;
