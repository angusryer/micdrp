/**
 * PitchLine — the live, scrolling pitch trace, drawn on the UI thread with Skia.
 *
 * The component renders ONCE. Every subsequent audio frame mutates Reanimated
 * shared values (written by useRecordController), and a `useDerivedValue`
 * worklet rebuilds the Skia `Path` entirely on the UI thread. React never
 * re-renders per frame, so the line stays smooth at 60/120fps regardless of JS
 * thread load (docs/NATIVE_BUILD_PLAN.md §0).
 *
 * Visual model: a fixed-length ring of recent MIDI samples. Each new frame
 * (detected by the monotonic `sharedFrame` counter) pushes the newest pitch in
 * and scrolls the history left. Pitch is mapped from the configured MIDI range
 * onto the canvas height; unvoiced frames create a gap (line break).
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { UNVOICED_MIDI } from './useRecordController';

export interface PitchLineProps {
  sharedMidi: SharedValue<number>;
  sharedFrame: SharedValue<number>;
  /** Canvas width in px. */
  width: number;
  /** Canvas height in px. */
  height: number;
  /** Number of frames kept on screen. Default 160. */
  historyLength?: number;
  /** Lowest MIDI note mapped to the bottom edge. Default 45 (A2). */
  minMidi?: number;
  /** Highest MIDI note mapped to the top edge. Default 84 (C6). */
  maxMidi?: number;
}

const DEFAULT_HISTORY = 160;
const DEFAULT_MIN_MIDI = 45;
const DEFAULT_MAX_MIDI = 84;

export function PitchLine({
  sharedMidi,
  sharedFrame,
  width,
  height,
  historyLength = DEFAULT_HISTORY,
  minMidi = DEFAULT_MIN_MIDI,
  maxMidi = DEFAULT_MAX_MIDI
}: PitchLineProps): React.JSX.Element {
  const { colors } = useTheme();

  // Ring buffer of recent MIDI values, owned on the UI thread. Pre-filled with
  // the unvoiced sentinel so the very first frames render as gaps, not noise.
  const history = useSharedValue<number[]>(
    new Array<number>(historyLength).fill(UNVOICED_MIDI)
  );
  // Last frame index we consumed; lets the worklet detect a new sample.
  const lastFrame = useSharedValue(-1);

  const span = Math.max(1, maxMidi - minMidi);

  const path = useDerivedValue(() => {
    'worklet';
    const frame = sharedFrame.value;
    // Append the newest sample only when a fresh frame has arrived.
    if (frame !== lastFrame.value) {
      lastFrame.value = frame;
      const next = history.value;
      next.push(sharedMidi.value);
      if (next.length > historyLength) {
        next.shift();
      }
      history.value = next;
    }

    const p = Skia.Path.Make();
    const buf = history.value;
    const n = buf.length;
    const dx = n > 1 ? width / (n - 1) : width;
    let penDown = false;
    for (let i = 0; i < n; i++) {
      const midi = buf[i];
      if (midi === UNVOICED_MIDI) {
        penDown = false; // break the line on unvoiced gaps
        continue;
      }
      const norm = (midi - minMidi) / span;
      const clamped = norm < 0 ? 0 : norm > 1 ? 1 : norm;
      const x = i * dx;
      const y = height - clamped * height;
      if (penDown) {
        p.lineTo(x, y);
      } else {
        p.moveTo(x, y);
        penDown = true;
      }
    }
    return p;
  }, [width, height, historyLength, minMidi, maxMidi]);

  const containerStyle = useMemo(
    () => [styles.container, { width, height }],
    [width, height]
  );

  return (
    <View style={containerStyle}>
      <Canvas style={styles.canvas}>
        <Path
          path={path}
          color={colors.primary500}
          style="stroke"
          strokeWidth={3}
          strokeJoin="round"
          strokeCap="round"
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  canvas: { flex: 1 }
});

export default PitchLine;
