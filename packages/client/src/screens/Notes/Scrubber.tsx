/**
 * Scrubber — where the take is, and how to go somewhere else in it.
 *
 * A round handle at the top edge of the graph trailing a faint line down
 * through it, so the same mark answers "where am I" and "take me there"
 * (INT-NOTES-022). It replaced the word "Shape", which said what the picture
 * already said.
 *
 * It rides inside the graph's own scroll and reads the graph's time axis, so
 * the moment it marks is under the notes sung at that moment however far the
 * take is scrolled or zoomed (INV-NOTES-034).
 *
 * It sits in a band above the drawing rather than over it, so it never covers
 * the notes it is pointing at (INV-NOTES-081), and it cannot be dragged past
 * the ends of the take — there is nothing to hear beyond them, and a handle
 * that travels into the pickup would claim a moment the recording does not
 * have.
 *
 * The moment arrives as a shared value the UI thread advances, not as a
 * number (INV-NOTES-206). It used to be React state read twice a second,
 * which meant every reading of the clock re-rendered the whole screen —
 * the graph, the neck, the chord track — and the render cost more than the
 * interval between readings, so the JS thread never went idle and a press
 * of pause had nowhere to be handled.
 */
import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '../../theme';
import { scrubPlacement } from './scrubPlacement';
import { msAtX, type TimeAxis } from '../../components/melodyScale';

/** The handle, and the reach around it a thumb actually gets. */
const HANDLE = 16;
const REACH = 34;

export interface ScrubberProps {
  /**
   * Where the take is now, on the UI thread.
   *
   * A shared value rather than a number: this moves continuously while a
   * take runs, and anything moving continuously above a canvas has to
   * move without a render (INV-NOTES-206).
   */
  positionMs: SharedValue<number>;
  timeAxis: TimeAxis;
  contentWidth: number;
  height: number;
  /** Where the singing starts. The handle does not go earlier than this. */
  firstNoteMs: number;
  /** Take the transport to a moment, in ms. */
  onSeek: (ms: number) => void;
  /**
   * A hand has taken hold of the head (INV-TPORT-018).
   *
   * Anything sounding stops for the duration of the drag, so the seeks
   * that follow move a head rather than restarting a take. This used to
   * send a seek on every pan update, and playing, each one was a stop, a
   * file token minted, a decode and a reschedule — sixty times a second,
   * each superseding the last, which left the control spinning over a
   * take that went on playing underneath it.
   */
  onGrab?: () => void;
  /** The hand has let go here. What was sounding carries on from it. */
  onRelease?: (ms: number) => void;
  /**
   * Where the finger is while it holds the head (INV-TPORT-033).
   *
   * Both coordinates, because the drawing moves under a still finger once
   * it starts carrying it: the one on the drawing goes stale, the one on
   * the screen does not. Null when the hand lets go.
   */
  onDrag?: (at: { contentX: number; screenX: number } | null) => void;
}

export function Scrubber({
  positionMs,
  timeAxis,
  contentWidth,
  height,
  firstNoteMs,
  onSeek,
  onGrab,
  onRelease,
  onDrag
}: ScrubberProps): React.JSX.Element | null {
  const { colors } = useTheme();

  // The axis owns the mapping and its inverse; this had its own copy of
  // the arithmetic, which is how a handle comes to be drawn beside the
  // moment it touches (INV-TPORT-035).
  const msAt = useCallback(
    (x: number) => msAtX(timeAxis, x, firstNoteMs),
    [timeAxis, firstNoteMs]
  );
  const seekTo = useCallback((x: number) => onSeek(msAt(x)), [msAt, onSeek]);

  /** Whether this gesture is the one holding the head. */
  const grabbed = useRef(false);
  const release = useCallback(
    (x: number) => {
      if (!grabbed.current) {
        return;
      }
      grabbed.current = false;
      onDrag?.(null);
      (onRelease ?? onSeek)(msAt(x));
    },
    [msAt, onDrag, onRelease, onSeek]
  );

  // Everything here is ordinary code, so the gesture runs on the JavaScript
  // side: calling it from the UI thread is a hard crash (INV-NOTES-042).
  //
  // One transport command for the whole drag, not one per update
  // (INV-TPORT-018): the grab stops what was sounding, so every seek in
  // between moves a head and decodes nothing, and the release puts it
  // down and carries on from there.
  //
  // On activation rather than on touch-down, so a tap never takes hold of
  // something it will not put back: a tap is answered by the tap gesture,
  // and a head grabbed by a press that then loses the race would leave
  // the take stopped with nothing left to resume it.
  const drag = Gesture.Pan()
    .withTestId('scrub')
    .onStart((e) => {
      grabbed.current = true;
      onGrab?.();
      onDrag?.({ contentX: e.x, screenX: e.absoluteX });
    })
    .onUpdate((e) => {
      onDrag?.({ contentX: e.x, screenX: e.absoluteX });
      seekTo(e.x);
    })
    .onEnd((e) => release(e.x))
    // A drag the system takes away has still let go of the head.
    .onFinalize((e) => release(e.x))
    .runOnJS(true);

  // A tap puts the head where you tapped. A pan never fires for a touch that
  // does not move, so without this the only way to reach a moment is to drag
  // to it from wherever the head happens to be (INV-NOTES-091).
  const tap = Gesture.Tap()
    .withTestId('scrub-tap')
    .onEnd((e) => seekTo(e.x))
    .runOnJS(true);

  const gesture = Gesture.Race(drag, tap);

  // Both marks placed on the UI thread from one value, so the handle and
  // the line under it can never disagree about the moment.
  //
  // Through a worklet, not through `xForMs`. Calling that from inside an
  // animated style is plain JavaScript reached from the UI thread, and it
  // crashed the app natively the instant a note was opened.
  const trailStyle = useAnimatedStyle(() => {
    'worklet';
    return { left: scrubPlacement(timeAxis, positionMs.value, firstNoteMs, HANDLE).trailX };
  });
  const handleStyle = useAnimatedStyle(() => {
    'worklet';
    return { left: scrubPlacement(timeAxis, positionMs.value, firstNoteMs, HANDLE).handleX };
  });

  return (
    <View
      style={[styles.layer, { width: contentWidth, height }]}
      pointerEvents="box-none"
    >
      {/* A short stem under the handle, pointing at the graph below the
          band, so the moment is readable without covering the notes. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.trail,
          { height, backgroundColor: colors.primary500 },
          trailStyle
        ]}
      />
      <GestureDetector gesture={gesture}>
        <View style={[styles.reach, { width: contentWidth, height: REACH }]}>
          <Animated.View
            testID="scrub-handle"
            style={[
              styles.handle,
              {
                backgroundColor: colors.primary500,
                borderColor: colors.neutral50
              },
              handleStyle
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export default Scrubber;

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
  trail: { position: 'absolute', top: 0, width: 1, opacity: 0.35 },
  reach: { position: 'absolute', top: 0, left: 0 },
  handle: {
    position: 'absolute',
    top: 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 2
  }
});
