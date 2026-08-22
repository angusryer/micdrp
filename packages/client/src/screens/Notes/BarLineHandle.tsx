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
import { StyleSheet, View } from 'react-native';

import type { BarHandle } from './barRulerModel';

export interface BarLineHandleProps {
  handle: BarHandle;
  height: number;
  color: string;
  /** Colour a line takes while it is the chosen thing. */
  chosenColor: string;
  isChosen: boolean;
}

export function BarLineHandle({
  handle,
  height,
  color,
  chosenColor,
  isChosen
}: BarLineHandleProps): React.JSX.Element {
  const { x } = handle;
  return (
    <View
      style={[styles.grab, { left: x - GRAB_WIDTH / 2, height }]}
      pointerEvents="none"
      testID={`bar-line-${handle.lineIndex}`}
    >
      <View
        style={[
          styles.line,
          isChosen ? styles.chosen : null,
          { backgroundColor: isChosen ? chosenColor : color }
        ]}
      />
    </View>
  );
}

export default BarLineHandle;

/** Wide enough to grab without the lines themselves becoming heavy. */
const GRAB_WIDTH = 44;

const styles = StyleSheet.create({
  grab: { position: 'absolute', top: 0, width: GRAB_WIDTH, alignItems: 'center' },
  line: { width: 2, height: '100%', opacity: 0.9 },
  chosen: { width: 4, opacity: 1 }
});
