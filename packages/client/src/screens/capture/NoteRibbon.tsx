/**
 * NoteRibbon — the current note name + a live cents-deviation meter.
 *
 * Both readouts are driven entirely from Reanimated shared values on the UI
 * thread (no React re-render per frame). The note label uses the classic
 * "ReText" technique — an animated, read-only `TextInput` whose `text` prop is
 * a `useAnimatedProps` worklet — so the string updates without touching React
 * state. The cents meter is a Skia needle whose offset is a `useDerivedValue`.
 *
 * The name itself is `NoteName`, shared with the recording view: two copies
 * of the MIDI-to-name mapping would be two things to keep in step, and they
 * would disagree at the edges.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Line, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { NoteName } from './NoteName';

export interface NoteRibbonProps {
  sharedMidi: SharedValue<number>;
  sharedCents: SharedValue<number>;
  /** Width of the cents meter in px. Default 240. */
  meterWidth?: number;
  /** Height of the cents meter in px. Default 24. */
  meterHeight?: number;
}

const DEFAULT_METER_WIDTH = 240;
const DEFAULT_METER_HEIGHT = 24;

export function NoteRibbon({
  sharedMidi,
  sharedCents,
  meterWidth = DEFAULT_METER_WIDTH,
  meterHeight = DEFAULT_METER_HEIGHT
}: NoteRibbonProps): React.JSX.Element {
  const { colors, typography } = useTheme();

  // Needle x-position: cents in [-50, 50] mapped across the meter width.
  const needleX = useDerivedValue(() => {
    const c = sharedCents.value;
    const clamped = c < -50 ? -50 : c > 50 ? 50 : c;
    return (clamped + 50) / 100 * meterWidth;
  }, [meterWidth]);

  const start = useDerivedValue(() => vec(needleX.value, 0), []);
  const end = useDerivedValue(() => vec(needleX.value, meterHeight), [meterHeight]);
  const center = useMemo(() => meterWidth / 2, [meterWidth]);

  const labelStyle = useMemo(
    () => [
      styles.note,
      { color: colors.typography, fontFamily: typography.h1.fontFamily }
    ],
    [colors.typography, typography.h1.fontFamily]
  );

  const meterStyle = useMemo(
    () => ({ width: meterWidth, height: meterHeight }),
    [meterWidth, meterHeight]
  );

  return (
    <View style={styles.container}>
      <NoteName sharedMidi={sharedMidi} style={labelStyle} />
      <Canvas style={meterStyle}>
        {/* zero / in-tune center reference */}
        <Line
          p1={vec(center, 0)}
          p2={vec(center, meterHeight)}
          color={colors.gray300}
          style="stroke"
          strokeWidth={1}
        />
        {/* live needle */}
        <Line
          p1={start}
          p2={end}
          color={colors.primary500}
          style="stroke"
          strokeWidth={3}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  note: {
    fontSize: 64,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    minWidth: 160
  }
});

export default NoteRibbon;
