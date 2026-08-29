/**
 * The beats somebody tapped, drawn.
 *
 * Its own colour, and solid, because it is the only thing on this graph that
 * was stated rather than read. The metre's rules are dotted because they are
 * rulings the app laid down (INV-NOTES-102); a tapped beat is a person saying
 * where the pulse is, which is content of the strongest kind the app has
 * (INV-NOTES-130).
 *
 * A beat marked as a bar start is drawn heavier and taller, so the shape of
 * the metre is readable across the take without counting.
 *
 * Only what was tapped. Nothing is inferred from these any more: a mark on a
 * recording must not redraw the thing it was made on (INV-NOTES-161).
 *
 * Paint only. Touches on the graph are read by one surface (INT-NOTES-015).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, vec } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { xForMs, type TimeAxis } from './melodyScale';
import type { TappedBeat } from 'logic';

/** How strongly a beat is drawn, against the rules it sits among. */
const BEAT_OPACITY = 0.55;
const DOWNBEAT_OPACITY = 0.9;

export interface TappedBeatsProps {
  beats: readonly TappedBeat[];
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
}

/** Where each beat is drawn, for the surface that has to touch one. */
export function beatLines(
  beats: readonly TappedBeat[],
  timeAxis: TimeAxis
): { index: number; x: number }[] {
  return beats.map((beat, index) => ({
    index,
    x: xForMs(timeAxis, beat.atMs)
  }));
}

export function TappedBeats({
  beats,
  timeAxis,
  contentWidth,
  height
}: TappedBeatsProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (beats.length === 0) {
    return null;
  }

  return (
    <View
      testID="tapped-beats"
      pointerEvents="none"
      style={[styles.layer, { width: contentWidth, height }]}
    >
      <Canvas style={{ width: contentWidth, height }}>
        {beats.map((beat, index) => {
          const x = xForMs(timeAxis, beat.atMs);
          return (
            <Line
              key={index}
              p1={vec(x, beat.isDownbeat ? 0 : height * 0.12)}
              p2={vec(x, beat.isDownbeat ? height : height * 0.88)}
              strokeWidth={beat.isDownbeat ? 2 : 1}
              color={beat.isDownbeat ? colors.gold : colors.primary500}
              opacity={beat.isDownbeat ? DOWNBEAT_OPACITY : BEAT_OPACITY}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

export default TappedBeats;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 }
});
