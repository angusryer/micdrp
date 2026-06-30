/**
 * PracticePitchView — the practice canvas: the target melody + the live sung
 * pitch, sharing one scrolling time axis, drawn entirely on the UI thread.
 *
 * The `sharedFrame` counter (bumped once per emitted audio frame by
 * useRecordController) is the transport clock: `currentMs = frame / fps * 1000`.
 * A "now" marker sits at `nowFraction` of the width; target notes to its right
 * are upcoming, to its left already sung. The live trace is a ring buffer whose
 * newest sample sits exactly at "now", so the two layers line up in time.
 *
 * The worklets inline the formulas from `practiceLayout.ts` (Reanimated worklets
 * can't call across modules); that module unit-tests the identical math.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';
import type { TargetNote } from 'logic';

import { useTheme } from '../../theme';
import { UNVOICED_MIDI } from '../capture/useRecordController';

export interface PracticePitchViewProps {
  sharedMidi: SharedValue<number>;
  sharedFrame: SharedValue<number>;
  /** The reference melody to draw (absolute-timed). */
  targets: readonly TargetNote[];
  width: number;
  height: number;
  /** Emit rate (frames/sec) — the transport clock's tick rate. Default 60. */
  fps?: number;
  /** Total visible time span in ms. Default 4000. */
  windowMs?: number;
  /** Horizontal position of "now", 0..1. Default 0.6. */
  nowFraction?: number;
  minMidi?: number;
  maxMidi?: number;
}

const DEFAULT_FPS = 60;
const DEFAULT_WINDOW_MS = 4000;
const DEFAULT_NOW_FRACTION = 0.6;
const DEFAULT_MIN_MIDI = 45;
const DEFAULT_MAX_MIDI = 84;

export function PracticePitchView({
  sharedMidi,
  sharedFrame,
  targets,
  width,
  height,
  fps = DEFAULT_FPS,
  windowMs = DEFAULT_WINDOW_MS,
  nowFraction = DEFAULT_NOW_FRACTION,
  minMidi = DEFAULT_MIN_MIDI,
  maxMidi = DEFAULT_MAX_MIDI
}: PracticePitchViewProps): React.JSX.Element {
  const { colors } = useTheme();

  const frameMs = 1000 / fps;
  const pxPerMs = width / windowMs;
  const nowXv = width * nowFraction;
  const span = Math.max(1, maxMidi - minMidi);

  // Enough history to fill the "past" portion (left of now) plus a margin.
  const historyLength = Math.ceil((nowFraction * windowMs) / frameMs) + 8;

  const history = useSharedValue<number[]>(
    new Array<number>(historyLength).fill(UNVOICED_MIDI)
  );
  const lastFrame = useSharedValue(-1);

  // ---- Target melody layer (horizontal segments, scrolling) ----
  const targetPath = useDerivedValue(() => {
    'worklet';
    const currentMs = sharedFrame.value * frameMs;
    const p = Skia.Path.Make();
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const x1 = nowXv + (t.startMs - currentMs) * pxPerMs;
      const x2 = nowXv + (t.endMs - currentMs) * pxPerMs;
      if (x2 < 0 || x1 > width) {
        continue;
      }
      const norm = (t.midi - minMidi) / span;
      const clamped = norm < 0 ? 0 : norm > 1 ? 1 : norm;
      const y = height - clamped * height;
      const a = x1 < 0 ? 0 : x1;
      const b = x2 > width ? width : x2;
      p.moveTo(a, y);
      p.lineTo(b, y);
    }
    return p;
  }, [targets, width, height, frameMs, pxPerMs, nowXv, span, minMidi, maxMidi]);

  // ---- Live sung-pitch layer (ring buffer, newest at "now") ----
  const livePath = useDerivedValue(() => {
    'worklet';
    const frame = sharedFrame.value;
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
    let penDown = false;
    for (let i = 0; i < n; i++) {
      const midi = buf[i];
      if (midi === UNVOICED_MIDI) {
        penDown = false;
        continue;
      }
      // Newest sample (i = n-1) sits at "now"; older samples scroll left.
      const offsetFrames = n - 1 - i;
      const x = nowXv - offsetFrames * frameMs * pxPerMs;
      if (x < 0) {
        penDown = false;
        continue;
      }
      const norm = (midi - minMidi) / span;
      const clamped = norm < 0 ? 0 : norm > 1 ? 1 : norm;
      const y = height - clamped * height;
      if (penDown) {
        p.lineTo(x, y);
      } else {
        p.moveTo(x, y);
        penDown = true;
      }
    }
    return p;
  }, [width, height, frameMs, pxPerMs, nowXv, span, historyLength, minMidi, maxMidi]);

  // ---- Static "now" marker (vertical line) ----
  const nowLine = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(nowXv, 0);
    p.lineTo(nowXv, height);
    return p;
  }, [nowXv, height]);

  const containerStyle = useMemo(
    () => [styles.container, { width, height }],
    [width, height]
  );

  return (
    <View style={containerStyle}>
      <Canvas style={styles.canvas}>
        <Path
          path={targetPath}
          color={colors.gray300}
          style="stroke"
          strokeWidth={8}
          strokeCap="round"
          opacity={0.6}
        />
        <Path
          path={nowLine}
          color={colors.gray500}
          style="stroke"
          strokeWidth={StyleSheet.hairlineWidth}
        />
        <Path
          path={livePath}
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

export default PracticePitchView;
