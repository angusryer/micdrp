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
import { useTranslation } from '../../i18n';
import { BarLineHandle, SLIDE_AWAY_PX } from './BarLineHandle';
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
  const { t } = useTranslation();
  const removeLabel = t('notes.barRemoveLabel');
  const moveCaption = t('notes.barMoveHint');
  const removeCaption = t('notes.barRemoveHint');
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    label: string;
    leaving: boolean;
  } | null>(null);

  const showDrag = useCallback(
    (lineIndex: number, x: number, y: number, liftY: number) => {
      // Say it before the finger lifts, so a throw can be taken back by
      // dragging down again (INT-NOTES-014).
      const leaving = liftY <= -SLIDE_AWAY_PX;
      setDrag({
        x,
        y,
        leaving,
        label: leaving ? removeLabel : previewAt(lineIndex, stepAtX(x))
      });
    },
    [previewAt, removeLabel, stepAtX]
  );

  const endDrag = useCallback(
    (lineIndex: number, x: number, liftY: number) => {
      setDrag(null);
      if (liftY <= -SLIDE_AWAY_PX) {
        onMerge(lineIndex);
        return;
      }
      onMove(lineIndex, stepAtX(x));
    },
    [onMerge, onMove, stepAtX]
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
        />
      ))}

      <DragLoupe
        isVisible={drag != null}
        touchX={drag?.x ?? 0}
        touchY={drag?.y ?? 0}
        bounds={{ width, height }}
        value={drag?.label ?? ''}
        caption={drag?.leaving ? removeCaption : moveCaption}
      />
    </View>
  );
}

export default BarRuler;
