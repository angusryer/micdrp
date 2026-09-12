/**
 * The count-in, drawn as one block and draggable onto the singing
 * (INV-NOTES-268).
 *
 * A person presses record, waits, and then comes in, so where the
 * recording starts is somewhere in that silence. What is being placed is
 * the count's *end* — the moment of coming in — so that is what the right
 * edge shows, and dragging puts it on the first note actually sung.
 *
 * The whole block moves: a count is a pulse with a length, and its beats
 * keep their spacing. Nothing of the take moves with it (INV-NOTES-253).
 *
 * A quick tap opens what the count is made of instead (INV-NOTES-269).
 * One thing under the finger answering two questions — where it goes and
 * what it is — so the block claims the touch only once the finger has
 * travelled far enough to be going somewhere. Everything else on this
 * graph claims it at once, because a handle is only ever dragged; this
 * one is not.
 *
 * Placed as a base plus an offset owned by the UI thread (INV-NOTES-235).
 * Moving the count moves the drawn window too — it opens to the earliest
 * thing there is — so the base shifts the instant the drag is committed,
 * and an offset still measured from the old base would draw the block a
 * second drag further on. `offsetFrom` returns nothing against a base it
 * was not taken from, which is what makes the settle frame land right.
 */
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

import { moveOffset, offsetFrom, useDragOffset } from '../../components/dragOffset';
import { msForX, xForMs, type TimeAxis } from '../../components/melodyScale';
import { useTheme } from '../../theme';

export interface PickupBlockProps {
  /** Where the count begins and ends, in ms. Null where there is none. */
  fromMs: number;
  endMs: number;
  timeAxis: TimeAxis;
  height: number;
  /** Where the count came to rest. Said once, on release. */
  onSettled: (endMs: number) => void;
  /** The first touch, so anything sounding can stop before the drag. */
  onGrab?: () => void;
  /** A quick tap: open what the count is made of (INV-NOTES-269). */
  onOpen?: () => void;
  /** True while its sheet is open, so the block says it is the subject. */
  isChosen?: boolean;
}

export function PickupBlock({
  fromMs,
  endMs,
  timeAxis,
  height,
  onSettled,
  onGrab,
  onOpen,
  isChosen = false
}: PickupBlockProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const drag = useDragOffset();
  const wasAt = useSharedValue(0);

  const left = xForMs(timeAxis, fromMs);
  const width = Math.max(2, xForMs(timeAxis, endMs) - left);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Named, so a test can drive the whole drag rather than assert the
        // shape of one: what matters is where it ends up (INV-NOTES-235).
        .withTestId('pickup-block-pan')
        // Far enough to be going somewhere. At zero the pan claims the
        // touch the instant it lands and the tap can never win, so the
        // count could be moved and never opened (INV-NOTES-269).
        .minDistance(TRAVELLED_PX)
        .onBegin(() => {
          wasAt.value = offsetFrom(drag, left);
          if (onGrab) {
            runOnJS(onGrab)();
          }
        })
        .onUpdate((e) => {
          moveOffset(drag, left, wasAt.value + e.translationX);
        })
        // The only other crossing: nothing between the touch and the
        // release reaches the JS thread.
        .onEnd(() => runOnJS(onSettled)(left + offsetFrom(drag, left) + width)),
    [drag, wasAt, left, width, onGrab, onSettled]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .withTestId('pickup-block-tap')
        .maxDistance(TRAVELLED_PX)
        .onEnd(() => {
          if (onOpen) {
            runOnJS(onOpen)();
          }
        }),
    [onOpen]
  );

  // The tap first: a touch that never travels is not a drag, and the pan
  // has already refused it by then.
  const gesture = useMemo(() => Gesture.Exclusive(tap, pan), [tap, pan]);

  const place = useAnimatedStyle(() => ({
    transform: [{ translateX: left + offsetFrom(drag, left) }]
  }));

  if (!(timeAxis.pxPerMs > 0) || !(endMs > fromMs)) {
    return null;
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel="Drag the count-in onto where the singing starts"
        testID="pickup-block"
        style={[
          styles.block,
          {
            width,
            height,
            borderColor: isChosen ? colors.primary500 : colors.gray300,
            backgroundColor: colors.neutral100,
            // Brighter while its sheet is open, so the thing being talked
            // about and the thing on the graph are plainly one thing.
            opacity: isChosen ? 0.6 : 0.35
          },
          place
        ]}
      />
    </GestureDetector>
  );
}

/** Where a released block puts the count's end, in ms. */
export function endAtX(timeAxis: TimeAxis, x: number): number {
  return msForX(timeAxis, x);
}

export default PickupBlock;

/** How far a finger travels before it is going somewhere rather than here. */
const TRAVELLED_PX = 8;

const styles = StyleSheet.create({
  // Placed by a transform rather than by `left`, so moving it is a
  // property the UI thread can write without a layout pass.
  //
  // Faint and outlined: the count is not part of the recording, and a
  // filled block over the graph would read as something that was sung.
  block: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 6
  }
});
