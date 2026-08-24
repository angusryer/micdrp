/**
 * The struck sounds in a take, drawn.
 *
 * Its own band because a hit has no pitch: there is no height on the melody
 * graph that means anything for it, and putting one there would be inventing a
 * pitch for a sound that has none (INV-NOTES-117).
 *
 * Inside the graph's own scroll, on the graph's own time axis, so a drum sits
 * under the note it was struck against at every zoom and scroll position. The
 * same arrangement as the chord strip (INV-NOTES-061), and for the same reason
 * the downbeats needed fixing twice: two mappings over one timeline disagree
 * eventually, and the disagreement is invisible until it is large.
 *
 * Paint only. Touches on the graph are read by one surface (INT-NOTES-015),
 * and this keeps that true by not asking for any.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, RoundedRect } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { layoutHits, lanesUsed } from './rhythmLanes';
import type { TimeAxis } from './melodyScale';
import type { Hit, HitKind } from 'logic';

/** How tall one lane is. Enough to strike a mark in and see it. */
export const LANE_HEIGHT = 18;

/** How tall the band is for this many hits, or zero when there are none. */
export function rhythmBandHeight(hits: readonly Hit[]): number {
  return lanesUsed(hits).length * LANE_HEIGHT;
}

export interface RhythmBandProps {
  hits: readonly Hit[];
  /** The graph's own mapping from time to x. Not a second one. */
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
}

export function RhythmBand({
  hits,
  timeAxis,
  contentWidth,
  height
}: RhythmBandProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const marks = useMemo(
    () => layoutHits(hits, timeAxis, height),
    [hits, timeAxis, height]
  );
  if (marks.length === 0) {
    return null;
  }

  // A colour per kind, so the band can be read without counting rows. Muted
  // like the chord notes: the drums are a reading of the take, and the
  // performance stays the loudest thing on the screen (INV-NOTES-105).
  const colourOf = (kind: HitKind): string =>
    kind === 'thump'
      ? colors.gold
      : kind === 'hiss'
        ? colors.primary500
        : kind === 'tap'
          ? colors.gray300
          : colors.neutral500;

  return (
    <View
      testID="rhythm-band"
      pointerEvents="none"
      style={[styles.band, { width: contentWidth, height }]}
    >
      <Canvas style={{ width: contentWidth, height }}>
        {marks.map((mark) => (
          <React.Fragment key={mark.index}>
            {/* A stroke as long as the sound, and a head where it landed.
                The head is what the eye reads the rhythm from; the stroke is
                how long it rang. */}
            <RoundedRect
              x={mark.x}
              y={mark.y - 1}
              width={mark.width}
              height={2}
              r={1}
              color={colourOf(mark.kind)}
              opacity={0.35 + mark.strength * 0.4}
            />
            <Circle
              cx={mark.x}
              cy={mark.y}
              r={3 + mark.strength * 3}
              color={colourOf(mark.kind)}
              opacity={0.5 + mark.strength * 0.5}
            />
          </React.Fragment>
        ))}
      </Canvas>
    </View>
  );
}

export default RhythmBand;

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0 }
});
