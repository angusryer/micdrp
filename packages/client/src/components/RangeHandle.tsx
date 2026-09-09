/**
 * One end of a playable stretch, dragged along the time axis.
 *
 * Its own colour, so the two ends are told apart from each other and from the
 * playhead — three vertical lines on one graph, all meaning different things
 * (INV-NOTES-179).
 *
 * It moves itself. Where it sits is a value the UI thread owns, so the drag
 * follows the finger without a render (INV-NOTES-235) — it used to report
 * every frame to the page holding the stretch, which read that stretch beside
 * the graph, so dragging an end reconciled the whole graph sixty times a
 * second. What it means is said once, when the finger leaves.
 *
 * Knows only where it is in pixels and what to say when it settles. It does
 * not know what the stretch was marked around, or what plays it.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

import { moveOffset, offsetFrom, type DragOffset } from './dragOffset';

/** How wide the invisible part a finger may land on is, in px. */
const GRAB_WIDTH = 32;

/** How wide the drawn line is. */
const LINE_WIDTH = 2;

export interface RangeHandleProps {
  /** Where the committed stretch puts it, in the graph's own pixel space. */
  baseX: number;
  /** How far the finger has taken it from there, owned by the UI thread. */
  drag: DragOffset;
  /** How far it may travel, in that same space. */
  lowX: number;
  highX: number;
  height: number;
  color: string;
  /** Which way its grip points — outwards, away from the stretch. */
  facing: 'left' | 'right';
  /** The first touch, so what is sounding can stop before the drag begins. */
  onGrab: () => void;
  /** Where it came to rest. Said once, on release (INV-NOTES-235). */
  onSettled: (x: number) => void;
  testID?: string;
}

export function RangeHandle({
  baseX,
  drag,
  lowX,
  highX,
  height,
  color,
  facing,
  onGrab,
  onSettled,
  testID
}: RangeHandleProps): React.JSX.Element {
  /** Where it was when the finger landed, so the drag is measured from there. */
  const wasAt = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Named, so a test can drive the whole drag rather than assert the
        // shape of one — the invariant here is about what happens between the
        // first touch and the release (INV-NOTES-235).
        .withTestId(`${testID ?? 'range'}-pan`)
        // Claimed on touch-down rather than after a threshold: the handle is
        // a control, and everything under it is already spoken for.
        .minDistance(0)
        .onBegin(() => {
          wasAt.value = offsetFrom(drag, baseX);
          // Once, here, rather than on every frame: falling silent while a
          // stretch is being decided is a thing that happens when the finger
          // lands, not a thing that keeps happening.
          runOnJS(onGrab)();
        })
        .onUpdate((e) => {
          const wanted = baseX + wasAt.value + e.translationX;
          const held = wanted < lowX ? lowX : wanted > highX ? highX : wanted;
          moveOffset(drag, baseX, held - baseX);
        })
        // The only other crossing. Nothing between the first touch and the
        // release reaches the JS thread at all.
        .onEnd(() => runOnJS(onSettled)(baseX + offsetFrom(drag, baseX))),
    [baseX, drag, wasAt, lowX, highX, onGrab, onSettled, testID]
  );

  const place = useAnimatedStyle(() => ({
    transform: [{ translateX: baseX + offsetFrom(drag, baseX) - GRAB_WIDTH / 2 }]
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID={testID} style={[styles.grab, { height }, place]}>
        <View style={[styles.line, { backgroundColor: color }]} />
        <View
          style={[
            styles.grip,
            { backgroundColor: color },
            facing === 'left' ? styles.gripLeft : styles.gripRight
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // Placed by a transform rather than by `left`, so moving it is a property
  // the UI thread can write without a layout pass.
  grab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: GRAB_WIDTH,
    alignItems: 'center'
  },
  line: { width: LINE_WIDTH, height: '100%' },
  // A tab at the top, on the outside, so it never sits over the stretch it
  // bounds and can be found without covering what is being judged.
  grip: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 16,
    borderRadius: 3
  },
  gripLeft: { right: GRAB_WIDTH / 2 + LINE_WIDTH / 2 },
  gripRight: { left: GRAB_WIDTH / 2 + LINE_WIDTH / 2 }
});

export default RangeHandle;
