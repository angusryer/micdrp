/**
 * Writing a note into the take, from the top of the playhead
 * (INV-NOTES-245).
 *
 * At the playhead because that is where a person's attention already is,
 * and because it is the one moment on the graph the app and the person
 * already agree about. A note added anywhere else needs a moment chosen
 * first, which is a second decision for the same act.
 *
 * Two taps, not a swipe. A swipe down from the head competed with the
 * page it sits on — the page scrolls vertically, so the gesture had to be
 * claimed from it, and a note was written every time a scroll started
 * near the head. Two taps on a target this size cannot be anything else.
 *
 * The pitch is the one the note lands on, not one the gesture carries: a
 * tap has no distance to read a pitch from, so the note arrives at the
 * middle of what is on screen and is dragged from there — which is the
 * same act as correcting any other note (INT-NOTES-030).
 *
 * Follows the head on the UI thread, from the same shared value and the
 * same placement worklet, so the grab is never a frame behind the line it
 * belongs to (INV-NOTES-136).
 */
import React, { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { type PitchAxis } from '../../components/melodyPitch';
import { type TimeAxis } from '../../components/melodyScale';
import { tapped } from '../../utilities/haptics';
import { headPlacement } from './playheadPlacement';
import { useTheme } from '../../theme';

/** How big the grab is. Aimed at rather than swept, so not small. */
const SIZE = 30;

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

/** The pitch a written note arrives at: the middle of what is on screen. */
export function middlePitch(axis: PitchAxis): number {
  return Math.round((axis.midiLow + axis.midiHigh) / 2);
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
   * The moment comes from the head's own value rather than from where the
   * touch landed: the note belongs to the playhead, and a finger a few
   * pixels off it would write the note a few milliseconds early.
   */
  const write = useCallback(() => {
    tapped();
    onWrite(positionMs.value, middlePitch(pitchAxis));
  }, [onWrite, pitchAxis, positionMs]);

  const twoTaps = Gesture.Tap()
    .withTestId('write-note-handle')
    .numberOfTaps(2)
    .onEnd(() => write())
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
      <GestureDetector gesture={twoTaps}>
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel="Tap twice to write a note here"
          testID="write-note-handle"
          style={[
            styles.grab,
            { borderColor: colors.primary500, backgroundColor: colors.neutral50 },
            follow
          ]}
        >
          {/* A plus and a note: what the mark does, and what it makes.
              Outlined rather than filled, so it reads as a control on the
              graph rather than as something that was sung. */}
          <Text style={[styles.glyph, { color: colors.primary500 }]}>+♪</Text>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default WriteNoteHandle;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  // Centred on the line, which is one pixel wide and sits at translateX.
  // A circle centred on the line, which is one pixel wide and sits at
  // translateX.
  grab: {
    position: 'absolute',
    top: 0,
    left: -SIZE / 2 + 0.5,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  glyph: { fontSize: 13, fontWeight: '700' }
});
