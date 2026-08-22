/**
 * BarLineHandle — one bar line, the hold that picks it up, and the drag that
 * moves or discards it.
 *
 * Nothing happens until the line has been held: the graph is covered in bar
 * lines, so a swipe along the take or a pinch beginning on one is the common
 * case, and either would otherwise drag the metre out from under the singer
 * (INT-NOTES-012).
 *
 * Once held, the line follows the finger (INV-NOTES-045) and the first real
 * movement decides the direction for the rest of the gesture (INV-NOTES-046):
 * sideways says where it goes, upward says away. Everything that moves is a
 * shared value driven on the UI thread — a drag rendered through React would
 * lag the thumb it is supposed to be under.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import type { BarHandle } from './barRulerModel';
import { useBarLineDrag } from './useBarLineDrag';

export { FLICK_VELOCITY, PICK_UP_MS, SLIDE_AWAY_PX } from './useBarLineDrag';

/** Wide enough to grab without the lines themselves becoming heavy. */
const GRAB_WIDTH = 44;

export interface BarLineHandleProps {
  handle: BarHandle;
  height: number;
  color: string;
  /** Colour a line takes on once releasing it would discard it. */
  dangerColor: string;
  /** Colour of the halo under a line while it is held. */
  glowColor: string;
  /** Step zero and step size, in the graph's own coordinates. */
  originX: number;
  stepWidth: number;
  /** Live position, for the readout that follows the finger. */
  onDrag: (lineIndex: number, x: number, y: number, axis: number, armed: number) => void;
  /** Released sideways: put the line at the step under the finger. */
  onDrop: (lineIndex: number, x: number) => void;
  /** Released upward: the line goes. */
  onRemove: (lineIndex: number) => void;
}

export function BarLineHandle({
  handle,
  height,
  color,
  dangerColor,
  glowColor,
  originX,
  stepWidth,
  onDrag,
  onDrop,
  onRemove
}: BarLineHandleProps): React.JSX.Element {
  const { lineIndex, x } = handle;

  const { pan, moving, danger, glow } = useBarLineDrag({
    lineIndex,
    handleX: x,
    originX,
    stepWidth,
    throwDistance: height + GRAB_WIDTH,
    onDrag,
    onDrop,
    onRemove
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.grab, { left: x - GRAB_WIDTH / 2, height }, moving]}
        testID={`bar-line-${lineIndex}`}
      >
        {/* A halo under the line the moment it is picked up, so the hold
            that earned it is felt as well as waited out. */}
        <Animated.View
          style={[styles.glow, { backgroundColor: glowColor }, glow]}
          pointerEvents="none"
        />
        <View style={[styles.line, { backgroundColor: color }]} />
        {/* Says the line is going before the finger lifts, so the throw can
            be taken back by bringing it down again (INT-NOTES-014). */}
        <Animated.View style={[styles.danger, danger]} pointerEvents="none">
          <View style={[styles.line, { backgroundColor: dangerColor }]} />
          <View style={[styles.badge, { backgroundColor: dangerColor }]}>
            <Text style={styles.badgeMark}>×</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export default BarLineHandle;

const styles = StyleSheet.create({
  grab: {
    position: 'absolute',
    top: 0,
    width: GRAB_WIDTH,
    alignItems: 'center'
  },
  line: { width: 2, height: '100%', opacity: 0.9 },
  glow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 12,
    borderRadius: 6,
    opacity: 0.28
  },
  danger: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center'
  },
  badge: {
    position: 'absolute',
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeMark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 }
});
