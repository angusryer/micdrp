/**
 * One bar line, wide enough for a thumb to catch.
 *
 * The line is drawn at `x`, which during a drag is where the finger has taken
 * it rather than where the arrangement still has it (INV-NOTES-028). Holding
 * it still instead joins the bars either side.
 *
 * The gesture reports movement and not position on purpose: the view being
 * measured against is the one moving under the finger, so a position read
 * from it would chase itself. Movement is added to where the line stood when
 * the drag began, which is what `restX` is.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/** Wide enough to grab without the lines themselves becoming heavy. */
export const GRAB_WIDTH = 44;

export interface BarLineHandleProps {
  lineIndex: number;
  /** Where to draw the line: its own step, or the finger's while dragging. */
  x: number;
  /** Where the line sits in the arrangement, which movement is added to. */
  restX: number;
  height: number;
  color: string;
  onDrag: (lineIndex: number, x: number, y: number) => void;
  onDrop: (lineIndex: number, x: number) => void;
  onMerge: (lineIndex: number) => void;
}

export function BarLineHandle({
  lineIndex,
  x,
  restX,
  height,
  color,
  onDrag,
  onDrop,
  onMerge
}: BarLineHandleProps): React.JSX.Element {
  const pan = Gesture.Pan()
    .withTestId(`bar-line-pan-${lineIndex}`)
    .onUpdate((event) =>
      runOnJS(onDrag)(lineIndex, restX + event.translationX, event.y)
    )
    .onEnd((event) => runOnJS(onDrop)(lineIndex, restX + event.translationX));

  const merge = Gesture.LongPress()
    .withTestId(`bar-line-merge-${lineIndex}`)
    .onStart(() => runOnJS(onMerge)(lineIndex));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, merge)}>
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
  grab: { position: 'absolute', top: 0, width: GRAB_WIDTH, alignItems: 'center' },
  line: { width: 2, height: '100%', opacity: 0.9 }
});

export default BarLineHandle;
