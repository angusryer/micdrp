/**
 * The moment the take has reached, drawn on the UI thread.
 *
 * The classic read-only animated TextInput, the same one the sung note's
 * name uses: the position advances every frame and must never become React
 * state, or reading the clock re-renders the graph it is drawn beside
 * (INV-NOTES-206, INV-NOTES-227).
 */
import React from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Minutes and seconds, on the UI thread. */
export function clockLabel(ms: number): string {
  'worklet';
  const whole = Math.max(0, Math.floor(ms / 1000));
  const seconds = whole % 60;
  return `${Math.floor(whole / 60)}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export interface RunClockProps {
  positionMs: SharedValue<number>;
  color: string;
  style?: TextStyle;
  testID?: string;
}

export function RunClock({
  positionMs,
  color,
  style,
  testID
}: RunClockProps): React.JSX.Element {
  const text = useDerivedValue(() => clockLabel(positionMs.value), []);
  const animatedProps = useAnimatedProps(() => ({
    text: text.value,
    defaultValue: text.value
  }));

  return (
    <AnimatedTextInput
      testID={testID}
      // Not a field anybody is meant to type in: it is a label that happens
      // to be written to natively. Left readable, though — the moment the
      // take has reached is worth as much to a screen reader as to an eye.
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      style={[styles.clock, { color }, style]}
    />
  );
}

export default RunClock;

const styles = StyleSheet.create({
  clock: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    padding: 0,
    textAlign: 'center'
  }
});
