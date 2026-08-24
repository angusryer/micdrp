/**
 * BarLineHandle — one bar line, the hold that picks it up, and the drag that
 * moves or discards it.
 *
 * Nothing happens until the line has been held: the graph is covered in bar
 * lines, so a swipe along the take or a pinch beginning on one is the common
 * case, and either would otherwise drag the metre out from under the singer
 * (INT-NOTES-012).
 *
 * Drawn for the chosen line only. Every downbeat is marked by the dotted rule
 * behind the notes, from the same arrangement; a solid line over each of them
 * said it twice, and read as a second kind of object that could not be picked
 * up (INV-NOTES-104).
 *
 * Once held, the line follows the finger (INV-NOTES-045) and the first real
 * movement decides the direction for the rest of the gesture (INV-NOTES-046):
 * sideways says where it goes, upward says away. Everything that moves is a
 * shared value driven on the UI thread — a drag rendered through React would
 * lag the thumb it is supposed to be under.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { DOWNBEAT_OPACITY } from '../../components/metreLines';
import type { BarHandle } from './barRulerModel';

export interface BarLineHandleProps {
  handle: BarHandle;
  height: number;
  color: string;
}

export function BarLineHandle({
  handle,
  height,
  color
}: BarLineHandleProps): React.JSX.Element {
  const { x } = handle;
  return (
    <View
      style={[styles.grab, { left: x - GRAB_WIDTH / 2, height }]}
      pointerEvents="none"
      testID={`bar-line-${handle.lineIndex}`}
    >
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
}

export default BarLineHandle;

/** Wide enough to grab without the lines themselves becoming heavy. */
const GRAB_WIDTH = 44;

const styles = StyleSheet.create({
  grab: { position: 'absolute', top: 0, width: GRAB_WIDTH, alignItems: 'center' },
  line: { width: 4, height: '100%', opacity: DOWNBEAT_OPACITY }
});
