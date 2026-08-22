/**
 * The bar lines over a melody, and the gestures that arrange them.
 *
 * Detected metre is the weakest inference in the analysis, so this is where a
 * person overrules it: drag a line to move it, hold inside a bar to split it,
 * hold a line to merge. The take is never touched — only where the bars fall
 * across it (INV-TRANS-012).
 *
 * While a drag is live the readout follows the finger from above and to one
 * side. A person cannot judge a placement they are covering with their own
 * hand (INV-NOTES-025).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { DragLoupe } from '../../components/DragLoupe';
import { useTheme } from '../../theme';
import type { BarHandle } from './barRulerModel';

export interface BarRulerProps {
  handles: readonly BarHandle[];
  width: number;
  height: number;
  /** Turn an x into a grid step, so a drag knows where it is going. */
  stepAtX: (x: number) => number;
  /** What the bars either side would read as, were the line dropped here. */
  previewAt: (lineIndex: number, step: number) => string;
  onMove: (lineIndex: number, step: number) => void;
  onSplit: (step: number) => void;
  onMerge: (lineIndex: number) => void;
}

/** Wide enough to grab without the lines themselves becoming heavy. */
const GRAB_WIDTH = 44;

export function BarRuler({
  handles,
  width,
  height,
  stepAtX,
  previewAt,
  onMove,
  onSplit,
  onMerge
}: BarRulerProps): React.JSX.Element {
  const { colors } = useTheme();
  const [drag, setDrag] = useState<{ x: number; y: number; label: string } | null>(
    null
  );

  const showDrag = useCallback(
    (lineIndex: number, x: number, y: number) => {
      setDrag({ x, y, label: previewAt(lineIndex, stepAtX(x)) });
    },
    [previewAt, stepAtX]
  );

  const endDrag = useCallback(
    (lineIndex: number, x: number) => {
      setDrag(null);
      onMove(lineIndex, stepAtX(x));
    },
    [onMove, stepAtX]
  );

  // Only the touch position crosses; which grid step it landed on is worked
  // out here, on the JavaScript side (INV-NOTES-042). Converting it inside the
  // callback called stepAtX on the UI thread, which is a hard crash in a
  // release build — and invisible to the tests, since the reanimated mock runs
  // everything on one thread.
  const splitAtX = useCallback(
    (x: number) => onSplit(stepAtX(x)),
    [onSplit, stepAtX]
  );

  // Holding anywhere that is not a line splits the bar there. It is on the
  // backdrop rather than on each bar so a split can land anywhere.
  const split = Gesture.LongPress()
    .withTestId('bar-split')
    .onStart((event) => runOnJS(splitAtX)(event.x));

  return (
    <View style={StyleSheet.absoluteFill} testID="bar-ruler">
      <GestureDetector gesture={split}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      {handles.map((handle) => (
        <BarLineHandle
          key={handle.lineIndex}
          handle={handle}
          height={height}
          color={colors.primary700}
          onDrag={showDrag}
          onDrop={endDrag}
          onMerge={onMerge}
        />
      ))}

      <DragLoupe
        isVisible={drag != null}
        touchX={drag?.x ?? 0}
        touchY={drag?.y ?? 0}
        bounds={{ width, height }}
        value={drag?.label ?? ''}
        caption="drag to move · hold to join"
      />
    </View>
  );
}

interface HandleProps {
  handle: BarHandle;
  height: number;
  color: string;
  onDrag: (lineIndex: number, x: number, y: number) => void;
  onDrop: (lineIndex: number, x: number) => void;
  onMerge: (lineIndex: number) => void;
}

function BarLineHandle({
  handle,
  height,
  color,
  onDrag,
  onDrop,
  onMerge
}: HandleProps): React.JSX.Element {
  const { lineIndex, x } = handle;

  const pan = Gesture.Pan()
    .withTestId(`bar-line-pan-${lineIndex}`)
    .onUpdate((event) => runOnJS(onDrag)(lineIndex, event.absoluteX, event.absoluteY))
    .onEnd((event) => runOnJS(onDrop)(lineIndex, event.absoluteX));

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

export default BarRuler;
