/**
 * The bar lines over a melody, and the gestures that arrange them.
 *
 * Detected metre is the weakest inference in the analysis, so this is where a
 * person overrules it: drag a line to move it, hold inside a bar to split it,
 * hold a line to merge. The take is never touched — only where the bars fall
 * across it (INV-TRANS-012).
 *
 * While a drag is live the line moves with the finger, step by step, and the
 * readout follows from above and to one side. The line has to move: it is the
 * thing being placed (INV-NOTES-028). The readout has to keep clear: a person
 * cannot judge a placement they are covering with their own hand
 * (INV-NOTES-025).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { DragLoupe, LOUPE_CLEARANCE } from '../../components/DragLoupe';
import { useTheme } from '../../theme';
import { BarLineHandle } from './BarLineHandle';
import type { BarDrop, BarHandle } from './barRulerModel';

export interface BarRulerProps {
  handles: readonly BarHandle[];
  width: number;
  height: number;
  /** Turn an x into a grid step, so a hold knows where it is splitting. */
  stepAtX: (x: number) => number;
  /** Where the line would go if dropped here, and what that would read as. */
  dropAt: (lineIndex: number, x: number) => BarDrop;
  onMove: (lineIndex: number, step: number) => void;
  onSplit: (step: number) => void;
  onMerge: (lineIndex: number) => void;
}

interface LiveDrag {
  lineIndex: number;
  /** The finger, which is what the readout keeps clear of, not the line: a
   * line stopped against its neighbour is no longer where the thumb is. */
  touchX: number;
  touchY: number;
  drop: BarDrop;
}

/** The drag in flight, and the two things a dragging finger reports. */
function useLineDrag(
  dropAt: BarRulerProps['dropAt'],
  onMove: BarRulerProps['onMove']
) {
  const [drag, setDrag] = useState<LiveDrag | null>(null);

  return {
    drag,
    showDrag: useCallback(
      (lineIndex: number, x: number, y: number) => {
        setDrag({ lineIndex, touchX: x, touchY: y, drop: dropAt(lineIndex, x) });
      },
      [dropAt]
    ),
    // The drop commits the step the line was last drawn at, so letting go
    // changes nothing a person could see.
    endDrag: useCallback(
      (lineIndex: number, x: number) => {
        setDrag(null);
        onMove(lineIndex, dropAt(lineIndex, x).step);
      },
      [dropAt, onMove]
    )
  };
}

export function BarRuler({
  handles,
  width,
  height,
  stepAtX,
  dropAt,
  onMove,
  onSplit,
  onMerge
}: BarRulerProps): React.JSX.Element {
  const { colors } = useTheme();
  const { drag, showDrag, endDrag } = useLineDrag(dropAt, onMove);

  // Holding anywhere that is not a line splits the bar there. It is on the
  // backdrop rather than on each bar so a split can land anywhere.
  const split = Gesture.LongPress()
    .withTestId('bar-split')
    .onStart((event) => runOnJS(onSplit)(stepAtX(event.x)));

  return (
    <View style={StyleSheet.absoluteFill} testID="bar-ruler">
      <GestureDetector gesture={split}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      {handles.map((handle) => (
        <BarLineHandle
          key={handle.lineIndex}
          lineIndex={handle.lineIndex}
          x={drag?.lineIndex === handle.lineIndex ? drag.drop.x : handle.x}
          restX={handle.x}
          height={height}
          color={colors.primary700}
          onDrag={showDrag}
          onDrop={endDrag}
          onMerge={onMerge}
        />
      ))}

      <DragLoupe
        isVisible={drag != null}
        touchX={drag?.touchX ?? 0}
        touchY={drag?.touchY ?? 0}
        // The ruler is a short strip and nothing above it clips, so the
        // readout may ride above it: clamped inside the strip it would
        // settle level with the thumb, under the hand (INV-NOTES-025).
        bounds={{ width, height, top: -LOUPE_CLEARANCE }}
        value={drag?.drop.label ?? ''}
        caption="drag to move · hold to join"
      />
    </View>
  );
}

export default BarRuler;
