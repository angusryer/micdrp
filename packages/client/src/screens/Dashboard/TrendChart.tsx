/**
 * TrendChart — a lightweight Skia sparkline for the practice training trend.
 *
 * Plots a series of 0..100 values across a fixed time axis (evenly spaced by
 * sample index — the trend is "over sessions", not wall-clock). No heavy chart
 * dependency: a single Skia path plus a baseline. Pure presentational; it owns
 * no state and never touches the audio path.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia, Line, vec } from '@shopify/react-native-skia';

import { useTheme } from '../../theme';

export interface TrendChartProps {
  /** Series values, each 0..100, oldest first. */
  values: number[];
  width: number;
  height: number;
}

const PAD = 8;

/** Build the SVG path string for the polyline (exported for unit testing). */
export function buildTrendPath(
  values: number[],
  width: number,
  height: number,
  pad = PAD
): string {
  if (values.length === 0) {
    return '';
  }
  const innerW = Math.max(1, width - 2 * pad);
  const innerH = Math.max(1, height - 2 * pad);
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const clamped = v < 0 ? 0 : v > 100 ? 100 : v;
    const x = pad + i * stepX;
    // 100 at the top, 0 at the bottom.
    const y = pad + (1 - clamped / 100) * innerH;
    return { x, y };
  });

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  // A single point renders as a tiny horizontal dash so it's visible.
  if (points.length === 1) {
    d += ` L ${points[0].x + 1} ${points[0].y}`;
  }
  return d;
}

export function TrendChart({
  values,
  width,
  height
}: TrendChartProps): React.JSX.Element {
  const { colors } = useTheme();

  const path = useMemo(() => {
    const d = buildTrendPath(values, width, height);
    return d ? Skia.Path.MakeFromSVGString(d) : null;
  }, [values, width, height]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Line
          p1={vec(PAD, height - PAD)}
          p2={vec(width - PAD, height - PAD)}
          color={colors.neutral500}
          strokeWidth={StyleSheet.hairlineWidth}
        />
        {path ? (
          <Path
            path={path}
            style="stroke"
            strokeWidth={2.5}
            strokeJoin="round"
            strokeCap="round"
            color={colors.primary500}
          />
        ) : null}
      </Canvas>
    </View>
  );
}

export default TrendChart;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' }
});
