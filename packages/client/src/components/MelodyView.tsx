/**
 * MelodyView — a static "piano-roll" of a whole melody: time on the x-axis,
 * pitch on the y-axis. Each sung note is a rounded bar; a faint contour line
 * joins their centres so the melodic shape reads at a glance. This is the
 * intuitive counterpart to the live scrolling pitch line on the capture screen,
 * for melodies that are already saved (a note's detail, a Dashboard fragment).
 *
 * All positioning is the pure `melodyLayout` math (unit-tested); this component
 * only paints. It is off the live audio path — safe to render anywhere.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { layoutMelody, type MelodyGrid, type MelodyNote } from './melodyLayout';

export interface MelodyViewProps {
  notes: readonly MelodyNote[];
  width: number;
  height: number;
  /** Draw the faint contour line through note centres (default true). */
  showContour?: boolean;
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
}

export function MelodyView({
  notes,
  width,
  height,
  showContour = true,
  color,
  grid,
  beatWidth
}: MelodyViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary500;

  const layout = useMemo(
    () => layoutMelody(notes, { width, height, grid, beatWidth }),
    [notes, width, height, grid, beatWidth]
  );
  // What was actually drawn — `width` when fitted, wider when it scrolls.
  const drawnWidth = layout.contentWidth;

  // Contour: a polyline through each bar's left-edge centre, in time order.
  const contour = useMemo(() => {
    if (!showContour || layout.rects.length < 2) {
      return null;
    }
    const p = Skia.Path.Make();
    layout.rects.forEach((r, i) => {
      const x = r.x;
      if (i === 0) {
        p.moveTo(x, r.cy);
      } else {
        p.lineTo(x, r.cy);
      }
    });
    // Carry the line to the end of the last bar so it doesn't stop short.
    const last = layout.rects[layout.rects.length - 1];
    p.lineTo(last.x + last.width, last.cy);
    return p;
  }, [layout, showContour]);

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
        {contour ? (
          <Path
            path={contour}
            style="stroke"
            strokeWidth={1.5}
            strokeJoin="round"
            strokeCap="round"
            color={colors.primary100}
          />
        ) : null}
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
