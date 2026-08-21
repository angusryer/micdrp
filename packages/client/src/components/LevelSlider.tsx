/**
 * A slider for mixing by ear.
 *
 * Built here rather than pulled in: every slider package for React Native is
 * native code, and a native dependency cannot reach a device over the air. A
 * mixing control that needed a TestFlight build to try would defeat the point
 * of being able to adjust it while listening (INV-NOTES-027).
 *
 * Gesture handler and Reanimated are already in the binary, so this is free.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useTheme } from '../theme';

/** Big enough to catch, small enough not to crowd a row. */
const KNOB = 22;
const TRACK_HEIGHT = 4;

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

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // Reported continuously rather than on release: the whole point is hearing
  // the balance move while the finger is still down.
  const at = useCallback(
    (x: number) => {
      if (width <= 0) {
        return;
      }
      onChange(Math.min(1, Math.max(0, x / width)));
    },
    [width, onChange]
  );

  const pan = Gesture.Pan()
    .withTestId('level-slider-pan')
    .minDistance(0)
    .onBegin((e) => runOnJS(at)(e.x))
    .onUpdate((e) => runOnJS(at)(e.x));

  const filled = Math.min(1, Math.max(0, value));

  return (
    <GestureDetector gesture={pan}>
      <View
        testID="level-slider"
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
        onLayout={onLayout}
        style={styles.hit}
      >
        <View style={[styles.track, { backgroundColor: colors.neutral500 }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: colors.primary500, width: `${filled * 100}%` }
            ]}
          />
        </View>
        <View
          style={[
            styles.knob,
            {
              backgroundColor: colors.primary500,
              // Kept inside the track at both ends, so the knob never hangs
              // off the edge at nought or full.
              left: Math.max(0, Math.min(width - KNOB, filled * width - KNOB / 2))
            }
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: { height: 40, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden' },
  fill: { height: '100%' },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2
  }
});

export default LevelSlider;
