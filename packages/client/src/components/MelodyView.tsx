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
import { Canvas, Path, RoundedRect, Skia } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { layoutMelody, type MelodyNote } from './melodyLayout';

export interface MelodyViewProps {
  notes: readonly MelodyNote[];
  width: number;
  height: number;
  /** Draw the faint contour line through note centres (default true). */
  showContour?: boolean;
  /** Override the bar colour (defaults to the theme primary). */
  color?: string;
}

export function MelodyView({
  notes,
  width,
  height,
  showContour = true,
  color
}: MelodyViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const barColor = color ?? colors.primary500;

  const layout = useMemo(
    () => layoutMelody(notes, { width, height }),
    [notes, width, height]
  );

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
    <View style={[styles.wrap, { width, height }]}>
      <Canvas style={{ width, height }}>
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
