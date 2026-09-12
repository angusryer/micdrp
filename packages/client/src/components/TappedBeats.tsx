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
 * Three kinds, three looks (INV-NOTES-237, INV-NOTES-242). A beat tapped in
 * with a finger and a beat heard in the take are both things the person did,
 * so both are drawn full strength — in different colours, because the graph
 * must never claim somebody tapped what they sang. A beat worked out between
 * two of them is faint and short: it is the app's account of a stretch
 * nobody marked at all, and telling it apart at a glance is the whole
 * licence for drawing it.
 *
 * Only the tapped ones can be picked up. A derived beat is not a thing to
 * drag into place — it is a thing to replace by tapping one (INV-NOTES-238).
 *
 * Paint only. Touches on the graph are read by one surface (INT-NOTES-015).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, vec } from '@shopify/react-native-skia';

import { useTheme } from '../theme';
import { xForMs, type TimeAxis } from './melodyScale';
import type { DrawnBeat } from 'logic';

/** How strongly a beat is drawn, against the rules it sits among. */
const BEAT_OPACITY = 0.55;
const DOWNBEAT_OPACITY = 0.9;

/** And a worked-out one: present, and plainly not a statement. */
const DERIVED_OPACITY = 0.22;

/** The count-in's own beats, which belong to no part of the recording. */
const COUNT_OPACITY = 0.4;

/** Stable, so a take with no count is the same take on every render. */
const NO_COUNT: readonly number[] = [];

export interface TappedBeatsProps {
  /** Every beat, tapped and worked out, each saying which it is. */
  line: readonly DrawnBeat[];
  /**
   * The count-in's beats, in ms, all before the take (INV-NOTES-252).
   *
   * Drawn here rather than in their own layer so there is one place that
   * knows what a beat looks like. They are not of the take — nothing was
   * sung against them — so they are drawn as the count they are.
   */
  countIn?: readonly number[];
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
}

/** Where each beat is drawn, for the surface that has to touch one. */
export function beatLines(
  beats: readonly { atMs: number }[],
  timeAxis: TimeAxis
): { index: number; x: number }[] {
  return beats.map((beat, index) => ({
    index,
    x: xForMs(timeAxis, beat.atMs)
  }));
}

export function TappedBeats({
  line,
  countIn = NO_COUNT,
  timeAxis,
  contentWidth,
  height
}: TappedBeatsProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (line.length === 0 && countIn.length === 0) {
    return null;
  }

  return (
    <View
      testID="tapped-beats"
      pointerEvents="none"
      style={[styles.layer, { width: contentWidth, height }]}
    >
      <Canvas style={{ width: contentWidth, height }}>
        {countIn.map((atMs, index) => (
          // Full height and dashed-looking by its gap from the rest: the
          // count is a different thing from the take's own beat, and the
          // region it sits in holds no singing at all.
          <Line
            key={`count-${index}`}
            p1={vec(xForMs(timeAxis, atMs), 0)}
            p2={vec(xForMs(timeAxis, atMs), height)}
            strokeWidth={1}
            color={colors.gray300}
            opacity={COUNT_OPACITY}
          />
        ))}
        {line.map((beat, index) => {
          const x = xForMs(timeAxis, beat.atMs);
          // Short and faint where nobody tapped it: it reads as a tick
          // between the statements rather than as one of them.
          const inset = beat.kind === 'derived' ? 0.42 : 0.12;
          return (
            <Line
              key={index}
              p1={vec(x, beat.isDownbeat ? 0 : height * inset)}
              p2={vec(x, beat.isDownbeat ? height : height * (1 - inset))}
              strokeWidth={beat.isDownbeat ? 2 : 1}
              color={
                beat.isDownbeat
                  ? colors.gold
                  : beat.kind === 'voiced'
                    ? colors.voiced
                    : colors.primary500
              }
              opacity={
                beat.kind === 'derived'
                  ? DERIVED_OPACITY
                  : beat.isDownbeat
                    ? DOWNBEAT_OPACITY
                    : BEAT_OPACITY
              }
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
