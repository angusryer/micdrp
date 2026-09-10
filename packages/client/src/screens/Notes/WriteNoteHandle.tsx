/**
 * Writing a note into the take, from the top of the playhead
 * (INV-NOTES-245).
 *
 * At the playhead because that is where a person's attention already is,
 * and because it is the one moment on the graph the app and the person
 * already agree about. A note added anywhere else needs a moment chosen
 * first, which is a second decision for the same act.
 *
 * Downwards, because the handle sits at the top: the gesture runs into the
 * graph rather than off it, and where the finger comes to rest is the pitch
 * — the only thing the swipe carries.
 *
 * Follows the head on the UI thread, from the same shared value and the
 * same placement worklet, so the grab is never a frame behind the line it
 * belongs to (INV-NOTES-136).
 */
import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { midiForY, type PitchAxis } from '../../components/melodyPitch';
import { type TimeAxis } from '../../components/melodyScale';
import { tapped } from '../../utilities/haptics';
import { headPlacement } from './playheadPlacement';
import { useTheme } from '../../theme';

/** How far down the finger must travel before it means a note. */
const REACH_PX = 24;

/** How big the grab is. Played rather than pressed, so not small. */
const SIZE = 28;

export interface WriteNoteHandleProps {
  /** Where the take is now, in ms, read every frame. */
  positionMs: SharedValue<number>;
  timeAxis: TimeAxis;
  pitchAxis: PitchAxis;
  contentWidth: number;
  height: number;
  /** Write a note at this moment, at this pitch. */
  onWrite: (atMs: number, midi: number) => void;
}

export function WriteNoteHandle({
  positionMs,
  timeAxis,
  pitchAxis,
  contentWidth,
  height,
  onWrite
}: WriteNoteHandleProps): React.JSX.Element | null {
  const { colors } = useTheme();

  const follow = useAnimatedStyle(() => {
    'worklet';
    const { opacity, translateX } = headPlacement(timeAxis, positionMs.value);
    return { opacity, transform: [{ translateX }] };
  }, [timeAxis]);

  /**
   * Read at the end rather than while the finger moves.
   *
   * The moment comes from the head's own value rather than from where the
   * touch landed: the note belongs to the playhead, and a finger a few
   * pixels off it would write the note a few milliseconds early.
   */
  const write = useCallback(
    (y: number, travelled: number) => {
      if (travelled < REACH_PX) {
        return;
      }
      tapped();
      onWrite(positionMs.value, midiForY(pitchAxis, y));
    },
    [onWrite, pitchAxis, positionMs]
  );

  const swipe = Gesture.Pan()
    .withTestId('write-note-handle')
    // Downwards only. Up from here is nothing, and claiming the direction
    // would take it from whatever else may want it later.
    .activeOffsetY(12)
    .failOffsetY(-8)
    .onEnd((e) => write(e.y, e.translationY))
    .runOnJS(true);

  if (!(timeAxis.pxPerMs > 0)) {
    return null;
  }

  return (
    <Animated.View
      testID="write-note-layer"
      style={[styles.layer, { width: contentWidth, height }]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={swipe}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel="Swipe down to write a note here"
          testID="write-note-handle"
          style={[
            styles.grab,
            { backgroundColor: colors.primary500 },
            follow
          ]}
        />
      </GestureDetector>
    </Animated.View>
  );
}

export default WriteNoteHandle;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  // Centred on the line, which is one pixel wide and sits at translateX.
  grab: {
    position: 'absolute',
    top: 0,
    left: -SIZE / 2 + 0.5,
    width: SIZE,
    height: SIZE,
    borderBottomLeftRadius: SIZE / 2,
    borderBottomRightRadius: SIZE / 2,
    opacity: 0.9
  }
});
