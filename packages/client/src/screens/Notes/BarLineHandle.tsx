/**
 * BarLineHandle — one bar line, and the hold that picks it up.
 *
 * Nothing happens until the line has been held: the graph is covered in bar
 * lines, so a swipe along the take or a pinch beginning on one is the common
 * case, and either would otherwise drag the metre out from under the singer
 * (INT-NOTES-012). Once held, sideways says where it goes and upward says
 * away (INT-NOTES-014).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { BarHandle } from './barRulerModel';

/**
 * How long a line must be held before it is picked up.
 *
 * Long enough that a swipe along the take or a pinch beginning on a line is
 * plainly not a hold, short enough that picking one up deliberately does not
 * feel like waiting.
 */
export const PICK_UP_MS = 220;

/**
 * How far up a held line must be dragged before releasing it takes it away.
 *
 * Far enough that a sideways drag which wanders vertically does not delete a
 * bar line by accident — the two directions mean entirely different things.
 */
export const SLIDE_AWAY_PX = 56;

/** Wide enough to grab without the lines themselves becoming heavy. */
const GRAB_WIDTH = 44;

interface HandleProps {
  handle: BarHandle;
  height: number;
  color: string;
  onDrag: (lineIndex: number, x: number, y: number, liftY: number) => void;
  onDrop: (lineIndex: number, x: number, liftY: number) => void;
}

export function BarLineHandle({
  handle,
  height,
  color,
  onDrag,
  onDrop
}: HandleProps): React.JSX.Element {
  const { lineIndex, x } = handle;

  // Nothing happens until the line has been picked up. The graph is covered
  // in bar lines, so a swipe along the take or a pinch beginning on one is the
  // common case — and either would otherwise drag the metre out from under
  // the singer (INT-NOTES-012).
  const pan = Gesture.Pan()
    .withTestId(`bar-line-pan-${lineIndex}`)
    .activateAfterLongPress(PICK_UP_MS)
    .onUpdate((event) =>
      runOnJS(onDrag)(
        lineIndex,
        event.absoluteX,
        event.absoluteY,
        event.translationY
      )
    )
    .onEnd((event) =>
      runOnJS(onDrop)(lineIndex, event.absoluteX, event.translationY)
    );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.grab, { left: x - GRAB_WIDTH / 2, height }]}
        testID={`bar-line-${lineIndex}`}
      >
        <View style={[styles.line, { backgroundColor: color }]} />
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
  line: { width: 2, flex: 1 }
});
