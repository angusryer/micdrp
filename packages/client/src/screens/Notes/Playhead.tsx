/**
 * Playhead — where the take is, drawn down the whole graph.
 *
 * The scrubber's handle sits in its own band above the drawing so it never
 * covers the notes (INV-NOTES-081), but a mark only in that band answers
 * "where am I" for the top edge and leaves the eye to guess the rest. This is
 * the same moment carried the full height, over the notes rather than under
 * them: a line hidden behind the bars it is passing is not a playhead
 * (INV-NOTES-100).
 *
 * Moved on the UI thread, from a shared value the engine's clock corrects a
 * few times a second (INV-NOTES-136). It used to take its position as a prop
 * and so moved only when the graph re-rendered — twice a second, in visible
 * steps, and every step redrew the whole picture to move one line.
 *
 * Paint only. It is drawn after the surface that reads touches and takes
 * none, so nothing it crosses becomes harder to pick up.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue
} from 'react-native-reanimated';

import { type TimeAxis } from '../../components/melodyScale';
import { headPlacement } from './playheadPlacement';
import { useTheme } from '../../theme';

export interface PlayheadProps {
  /** Where the take is now, in ms, read every frame. */
  positionMs: SharedValue<number>;
  /**
   * Where a press would start from, used while nothing is running.
   *
   * The shared value follows where the last run of playback began, so on
   * its own the head stayed put after a rewind or a drag on a stopped
   * take (INV-NOTES-208).
   */
  cueMs: number;
  isPlaying: boolean;
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
}

export function Playhead({
  positionMs,
  cueMs,
  isPlaying,
  timeAxis,
  contentWidth,
  height
}: PlayheadProps): React.JSX.Element | null {
  const { colors } = useTheme();

  // Placed on the UI thread, every frame, without a render.
  const head = useAnimatedStyle(() => {
    'worklet';
    const at = isPlaying ? positionMs.value : cueMs;
    const { opacity, translateX } = headPlacement(timeAxis, at);
    return { opacity, transform: [{ translateX }] };
  }, [timeAxis]);

  if (!(timeAxis.pxPerMs > 0)) {
    return null;
  }

  return (
    <Animated.View
      testID="playhead"
      pointerEvents="none"
      style={[styles.layer, { width: contentWidth, height }]}
    >
      <Animated.View
        style={[
          styles.line,
          { height, backgroundColor: colors.primary500 },
          head
        ]}
      />
    </Animated.View>
  );
}

export default Playhead;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  // Thin and not quite solid: it crosses every note in the take, and a heavy
  // line would read as one more thing drawn rather than as a position.
  // Positioned by transform rather than by `left`, so moving it never asks
  // the layout engine anything.
  line: { position: 'absolute', top: 0, left: 0, width: 1 }
});
