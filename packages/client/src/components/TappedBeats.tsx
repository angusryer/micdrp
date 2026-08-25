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
 * The beats nobody tapped are drawn too, and fainter. Taps are sparse by
 * design, so most of the grid is inferred from them — and a beat that was
 * stated and a beat that was worked out are different claims, which the
 * drawing has to say rather than leave to be assumed (INV-NOTES-131).
 *
 * Paint only. Touches on the graph are read by one surface (INT-NOTES-015).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, vec } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { xForMs, type TimeAxis } from './melodyScale';
import type { Beat, TappedBeat } from 'logic';

/** How strongly a beat is drawn, against the rules it sits among. */
const BEAT_OPACITY = 0.55;
const DOWNBEAT_OPACITY = 0.9;

/** And an inferred one, which is a reading rather than a statement. */
const INFERRED_OPACITY = 0.18;

export interface TappedBeatsProps {
  beats: readonly TappedBeat[];
  /** The whole grid the taps imply. Only the untapped ones are drawn here. */
  inferred?: readonly Beat[];
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
  inferred = [],
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
        {inferred
          .filter((beat) => !beat.isTapped)
          .map((beat, index) => {
            const x = xForMs(timeAxis, beat.atMs);
            return (
              <Line
                key={`inferred-${index}`}
                p1={vec(x, beat.isDownbeat ? 0 : height * 0.2)}
                p2={vec(x, beat.isDownbeat ? height : height * 0.8)}
                strokeWidth={1}
                color={beat.isDownbeat ? colors.gold : colors.primary500}
                opacity={INFERRED_OPACITY}
              />
            );
          })}
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
