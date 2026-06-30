/**
 * NoteRibbon — the current note name + a live cents-deviation meter.
 *
 * Both readouts are driven entirely from Reanimated shared values on the UI
 * thread (no React re-render per frame). The note label uses the classic
 * "ReText" technique — an animated, read-only `TextInput` whose `text` prop is
 * a `useAnimatedProps` worklet — so the string updates without touching React
 * state. The cents meter is a Skia needle whose offset is a `useDerivedValue`.
 *
 * The MIDI → note-name mapping reuses `NOTE_NAMES` from `logic` (a pure,
 * worklet-safe constant); we never reimplement the conversion.
 */

import React, { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Canvas, Line, vec } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue
} from 'react-native-reanimated';
import { NOTE_NAMES } from 'logic';

import { useTheme } from '../../theme';
import { UNVOICED_MIDI } from './useRecordController';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

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

/** UI-thread MIDI → "C#4" label. Mirrors logic.frequencyToNote naming. */
function midiToLabel(midi: number): string {
  'worklet';
  if (midi === UNVOICED_MIDI || midi < 0) {
    return '—';
  }
  const rounded = Math.round(midi);
  const index = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[index]}${octave}`;
}

export function NoteRibbon({
  sharedMidi,
  sharedCents,
  meterWidth = DEFAULT_METER_WIDTH,
  meterHeight = DEFAULT_METER_HEIGHT
}: NoteRibbonProps): React.JSX.Element {
  const { colors, typography } = useTheme();

  const noteText = useDerivedValue(
    () => midiToLabel(sharedMidi.value),
    []
  );

  const animatedProps = useAnimatedProps(() => {
    // `text` is a defaultProp of TextInput; updating it here mutates the native
    // view directly, bypassing React state (the classic Reanimated "ReText").
    return { text: noteText.value, defaultValue: noteText.value };
  });

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
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        defaultValue="—"
        style={labelStyle}
        animatedProps={animatedProps}
      />
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
