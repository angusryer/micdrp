/**
 * A level, moved by dragging anywhere along it.
 *
 * The whole point is hearing the balance move while the finger is still down,
 * so it reports as it goes — but reporting and drawing are two different
 * questions and used to be one (INV-NOTES-235). Every frame of a drag crossed
 * to the JS thread, set state, and re-rendered everything reading the mix,
 * which on a note's page is the graph as well. The knob then drew itself from
 * that state, so the thing following the finger was doing so by way of a
 * render.
 *
 * Now the drawing is a value the UI thread owns and costs nothing, and the
 * reporting has a rate of its own — often enough that the balance moves under
 * the finger, rarely enough that it is not a render a frame. The exact
 * resting value is always sent last, so where it ends up is never an
 * approximation of where it was left.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

import { moveOffset, offsetFrom, useDragOffset } from './dragOffset';
import { useTheme } from '../theme';

const KNOB = 14;
const TRACK_HEIGHT = 4;

/**
 * How often the level is reported while a finger is down, in ms.
 *
 * Twenty times a second: smooth to an ear on a fader, and a third of the
 * renders a frame would cost. A distance threshold was tried first and gates
 * the wrong thing — it quietens a finger holding almost still, which was
 * never the expensive case, and does nothing at all for a sweep across the
 * track, which is.
 */
const SAY_EVERY_MS = 50;

export interface LevelSliderProps {
  /** 0..1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

export function LevelSlider({
  value,
  onChange,
  accessibilityLabel
}: LevelSliderProps): React.JSX.Element {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  /** How far the finger has taken it from the level as last reported, 0..1. */
  const drag = useDragOffset();
  /** When it was last reported, so the reporting has a rate rather than a frame. */
  const saidAt = useSharedValue(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const filled = Math.min(1, Math.max(0, value));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('level-slider-pan')
        .minDistance(0)
        // Landing on the track is itself a move: the level goes to where the
        // finger is, not to where it started.
        .onBegin((e) => {
          if (width <= 0) {
            return;
          }
          const wanted = e.x / width;
          const held = wanted < 0 ? 0 : wanted > 1 ? 1 : wanted;
          moveOffset(drag, filled, held - filled);
          saidAt.value = Date.now();
          runOnJS(onChange)(held);
        })
        .onUpdate((e) => {
          if (width <= 0) {
            return;
          }
          const wanted = e.x / width;
          const held = wanted < 0 ? 0 : wanted > 1 ? 1 : wanted;
          moveOffset(drag, filled, held - filled);
          // The drawing above has already followed. This is only about what
          // is heard, and an ear does not resolve sixty of these a second.
          const now = Date.now();
          if (now - saidAt.value >= SAY_EVERY_MS) {
            saidAt.value = now;
            runOnJS(onChange)(held);
          }
        })
        // Exactly where it was left, whatever the steps along the way said.
        .onEnd(() => runOnJS(onChange)(filled + offsetFrom(drag, filled))),
    // Rebuilt when the reported level changes, which during a drag is at the
    // reporting rate. Deliberate: the gesture and the drawing must measure
    // the offset from the same base, and holding the level in a shared value
    // to keep the gesture stable would let the two disagree for a frame —
    // which is the frame this whole design exists to remove. A rebuild costs
    // an object; a disagreement costs a jump.
    [drag, saidAt, width, filled, onChange]
  );

  const fill = useAnimatedStyle(() => ({
    width: `${(filled + offsetFrom(drag, filled)) * 100}%`
  }));

  const knob = useAnimatedStyle(() => ({
    // Kept inside the track at both ends, so the knob never hangs off the
    // edge at nought or full.
    transform: [
      {
        translateX: Math.max(
          0,
          Math.min(
          width - KNOB,
          (filled + offsetFrom(drag, filled)) * width - KNOB / 2
        )
        )
      }
    ]
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        testID="level-slider"
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
        onLayout={onLayout}
        style={styles.hit}>
        <View style={[styles.track, { backgroundColor: colors.neutral500 }]}>
          <Animated.View
            testID="level-slider-fill"
            style={[styles.fill, { backgroundColor: colors.primary500 }, fill]}
          />
        </View>
        <Animated.View
          style={[styles.knob, { backgroundColor: colors.primary500 }, knob]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: 40, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden'
  },
  fill: { height: '100%' },
  // Placed by a transform rather than by `left`: one the UI thread can write
  // without a layout pass, which is what lets it follow the finger.
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2
  }
});

export default LevelSlider;
