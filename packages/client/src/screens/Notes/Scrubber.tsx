/**
 * Scrubber — where the take is, and how to go somewhere else in it.
 *
 * A round handle at the top edge of the graph trailing a faint line down
 * through it, so the same mark answers "where am I" and "take me there"
 * (INT-NOTES-022). It replaced the word "Shape", which said what the picture
 * already said.
 *
 * It rides inside the graph's own scroll and reads the graph's time axis, so
 * the moment it marks is under the notes sung at that moment however far the
 * take is scrolled or zoomed (INV-NOTES-034).
 *
 * It sits in a band above the drawing rather than over it, so it never covers
 * the notes it is pointing at (INV-NOTES-081), and it cannot be dragged past
 * the ends of the take — there is nothing to hear beyond them, and a handle
 * that travels into the pickup would claim a moment the recording does not
 * have.
 *
 * The moment arrives as a shared value the UI thread advances, not as a
 * number (INV-NOTES-206). It used to be React state read twice a second,
 * which meant every reading of the clock re-rendered the whole screen —
 * the graph, the neck, the chord track — and the render cost more than the
 * interval between readings, so the JS thread never went idle and a press
 * of pause had nowhere to be handled.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../../theme';
import { xForMs, type TimeAxis } from '../../components/melodyScale';

/** The handle, and the reach around it a thumb actually gets. */
const HANDLE = 16;
const REACH = 34;

export interface ScrubberProps {
  /**
   * Where the take is now, on the UI thread.
   *
   * A shared value rather than a number: this moves continuously while a
   * take runs, and anything moving continuously above a canvas has to
   * move without a render (INV-NOTES-206).
   */
  positionMs: SharedValue<number>;
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
  /** Where the singing starts. The handle does not go earlier than this. */
  firstNoteMs: number;
  /** Take the transport to a moment, in ms. */
  onSeek: (ms: number) => void;
}

export function Scrubber({
  positionMs,
  timeAxis,
  contentWidth,
  height,
  firstNoteMs,
  onSeek
}: ScrubberProps): React.JSX.Element | null {
  const { colors } = useTheme();

  const msForX = useCallback(
    (x: number) =>
      timeAxis.pxPerMs > 0
        ? timeAxis.t0 + (x - timeAxis.pad) / timeAxis.pxPerMs
        : timeAxis.t0,
    [timeAxis]
  );

  // Held inside the take. Before the first note is the pickup, which has
  // nothing to play, and past the last there is nothing left.
  const seekTo = useCallback(
    (x: number) => {
      const last = timeAxis.t0 + timeAxis.span;
      onSeek(Math.min(Math.max(msForX(x), firstNoteMs), last));
    },
    [msForX, onSeek, timeAxis, firstNoteMs]
  );

  // Everything here is ordinary code, so the gesture runs on the JavaScript
  // side: calling it from the UI thread is a hard crash (INV-NOTES-042).
  const drag = Gesture.Pan()
    .withTestId('scrub')
    .onUpdate((e) => seekTo(e.x))
    .onEnd((e) => seekTo(e.x))
    .runOnJS(true);

  // A tap puts the head where you tapped. A pan never fires for a touch that
  // does not move, so without this the only way to reach a moment is to drag
  // to it from wherever the head happens to be (INV-NOTES-091).
  const tap = Gesture.Tap()
    .withTestId('scrub-tap')
    .onEnd((e) => seekTo(e.x))
    .runOnJS(true);

  const gesture = Gesture.Race(drag, tap);

  // Both marks are placed on the UI thread from the same value, so the
  // handle and the line under it can never disagree about the moment.
  const lastMs = timeAxis.t0 + timeAxis.span;
  const trailStyle = useAnimatedStyle(() => ({
    left: xForMs(
      timeAxis,
      Math.min(Math.max(positionMs.value, firstNoteMs), lastMs)
    )
  }));
  const handleStyle = useAnimatedStyle(() => ({
    left:
      xForMs(
        timeAxis,
        Math.min(Math.max(positionMs.value, firstNoteMs), lastMs)
      ) -
      HANDLE / 2
  }));

  return (
    <View
      style={[styles.layer, { width: contentWidth, height }]}
      pointerEvents="box-none"
    >
      {/* A short stem under the handle, pointing at the graph below the
          band, so the moment is readable without covering the notes. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.trail,
          { height, backgroundColor: colors.primary500 },
          trailStyle
        ]}
      />
      <GestureDetector gesture={gesture}>
        <View style={[styles.reach, { width: contentWidth, height: REACH }]}>
          <Animated.View
            testID="scrub-handle"
            style={[
              styles.handle,
              {
                backgroundColor: colors.primary500,
                borderColor: colors.neutral50
              },
              handleStyle
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export default Scrubber;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  trail: { position: 'absolute', top: 0, width: 1, opacity: 0.35 },
  reach: { position: 'absolute', top: 0, left: 0 },
  handle: {
    position: 'absolute',
    top: 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 2
  }
});
