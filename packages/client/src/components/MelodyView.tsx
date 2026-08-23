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
import {
  layoutMelody,
  xForMs,
  yForMidi,
  type MelodyGrid,
  type MelodyNote
} from './melodyLayout';

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
  /** Where the recording began, when earlier than the first sung note. */
  fromMs?: number;
  /**
   * A second performance drawn behind the sung line — the bass hummed
   * against it. Its own colour, because it is a different voice and reading
   * the picture depends on telling them apart (INV-NOTES-079).
   */
  underlay?: readonly MelodyNote[];
  underlayColor?: string;
}

export function MelodyView({
  notes,
  width,
  height,
  color,
  grid,
  beatWidth,
  alsoShow,
  fromMs,
  underlay,
  underlayColor
}: MelodyViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary500;

  const layout = useMemo(
    () =>
      layoutMelody(notes, { width, height, grid, beatWidth, alsoShow, fromMs }),
    [notes, width, height, grid, beatWidth, alsoShow, fromMs]
  );
  // Placed on the melody's OWN axes rather than laid out again: a second
  // layout would derive its own pitch window from its own notes, and the same
  // pitch would sit at two heights on one drawing. The caller passes the bass
  // pitches through `alsoShow` so the shared window already makes room.
  const under = useMemo(() => {
    if (!underlay?.length) {
      return [];
    }
    const barH = Math.max(2, layout.pitchAxis.lane * 0.7);
    return underlay.map((n) => {
      const cy = yForMidi(layout.pitchAxis, n.midi);
      return {
        x: xForMs(layout.timeAxis, n.startMs),
        y: cy - barH / 2,
        width: Math.max(2, (n.endMs - n.startMs) * layout.timeAxis.pxPerMs - 1),
        height: barH
      };
    });
  }, [underlay, layout]);
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
        {/* Where the singing starts, with the pickup before it. Fainter and
            its own colour: it marks a boundary in the recording rather than
            a beat in the music (INV-NOTES-080). */}
        {layout.timeAxis.t0 < layout.firstNoteMs ? (
          <Line
            p1={vec(xForMs(layout.timeAxis, layout.firstNoteMs), 0)}
            p2={vec(xForMs(layout.timeAxis, layout.firstNoteMs), height)}
            strokeWidth={1}
            color={colors.gray300}
            opacity={0.5}
          />
        ) : null}
        {/* Behind the sung line: it is context for it, not a rival to it. */}
        {under.map((r, i) => (
          <RoundedRect
            key={`u${i}`}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            r={radius}
            color={underlayColor ?? barColor}
            opacity={0.55}
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
