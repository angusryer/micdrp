/**
 * One end of a playable stretch, dragged along the time axis.
 *
 * Its own colour, so the two ends are told apart from each other and from the
 * playhead — three vertical lines on one graph, all meaning different things
 * (INV-NOTES-179).
 *
 * Knows only where it is in pixels and what to say when it moves. It does not
 * know what the stretch was marked around, or what plays it.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** How wide the invisible part a finger may land on is, in px. */
const GRAB_WIDTH = 32;

/** How wide the drawn line is. */
const LINE_WIDTH = 2;

export interface RangeHandleProps {
  /** Where it sits, in the same pixel space as the graph's content. */
  x: number;
  height: number;
  color: string;
  /** Which way its grip points — outwards, away from the stretch. */
  facing: 'left' | 'right';
  /** Where the finger has reached, in that same pixel space. */
  onMove: (x: number) => void;
  testID?: string;
}

export function RangeHandle({
  x,
  height,
  color,
  facing,
  onMove,
  testID
}: RangeHandleProps): React.JSX.Element {
  const drag = useMemo(
    () =>
      Gesture.Pan()
        // Claimed on touch-down rather than after a threshold: the handle is
        // a control, and everything under it is already spoken for.
        .onBegin((e) => onMove(x - GRAB_WIDTH / 2 + e.x))
        .onUpdate((e) => onMove(x - GRAB_WIDTH / 2 + e.x))
        .runOnJS(true),
    [onMove, x]
  );

  return (
    <GestureDetector gesture={drag}>
      <View
        testID={testID}
        style={[styles.grab, { height, left: x - GRAB_WIDTH / 2 }]}>
        <View style={[styles.line, { backgroundColor: color }]} />
        <View
          style={[
            styles.grip,
            { backgroundColor: color },
            facing === 'left' ? styles.gripLeft : styles.gripRight
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  grab: {
    position: 'absolute',
    top: 0,
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
