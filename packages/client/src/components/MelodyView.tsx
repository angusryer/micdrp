/**
 * MelodyView — a static "piano-roll" of a whole melody: time on the x-axis,
 * pitch on the y-axis. Each sung note is a rounded bar and nothing else.
 *
 * A line once joined their centres to show the melodic shape. It read as a
 * claim the take does not make — the voice does not travel between notes the
 * way a straight line between two centres suggests — and now that the notes
 * are things you can pick up and move, a line drawn across them is one more
 * thing in the way of the ones that matter.
 *
 * All positioning is the pure `melodyLayout` math (unit-tested); this component
 * only paints. It is off the live audio path — safe to render anywhere.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, RoundedRect, vec } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { layoutMelody, type MelodyGrid, type MelodyNote } from './melodyLayout';

export interface MelodyViewProps {
  notes: readonly MelodyNote[];
  width: number;
  height: number;
  /** Override the bar colour (defaults to the theme primary). */
  color?: string;
  /**
   * Draw bar and beat rules behind the melody.
   *
   * Omit it and the view is exactly as it was: a shape, with no claim about
   * where the beat sits. Supplying a grid is what turns the piano roll into
   * something you can read rhythm off.
   */
  grid?: MelodyGrid;
  /**
   * Pixels per beat. Given, a beat is that wide wherever it falls and the
   * drawing runs past `width` for a caller to scroll (INV-NOTES-032).
   * Omitted, the whole take is fitted to `width`, which is what a thumbnail
   * wants (INV-NOTES-035).
   */
  beatWidth?: number;
  /** Other pitches sharing this axis, so the window makes room for them. */
  alsoShow?: readonly number[];
}

export function MelodyView({
  notes,
  width,
  height,
  color,
  grid,
  beatWidth,
  alsoShow
}: MelodyViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary500;

  const layout = useMemo(
    () => layoutMelody(notes, { width, height, grid, beatWidth, alsoShow }),
    [notes, width, height, grid, beatWidth, alsoShow]
  );
  // What was actually drawn — `width` when fitted, wider when it scrolls.
  const drawnWidth = layout.contentWidth;

  const radius = Math.min(4, height / 16);

  return (
    <View style={[styles.wrap, { width: drawnWidth, height }]}>
      <Canvas style={{ width: drawnWidth, height }}>
        {/* Rules first, so the melody always reads on top of its own grid. */}
        {layout.gridLines.map((g, i) => (
          <Line
            key={`g${i}`}
            p1={vec(g.x, 0)}
            p2={vec(g.x, height)}
            strokeWidth={g.isBar ? 1 : StyleSheet.hairlineWidth}
            color={g.isBar ? colors.neutral500 : colors.neutral100}
          />
        ))}
        {layout.rects.map((r, i) => (
          <RoundedRect
            key={i}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            r={radius}
            color={barColor}
          />
        ))}
      </Canvas>
    </View>
  );
}

export default MelodyView;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' }
});
