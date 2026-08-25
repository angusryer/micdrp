/**
 * The note being heard, named, updated without a render.
 *
 * An animated read-only TextInput whose text comes from a worklet — the
 * classic "ReText" — so the label follows the voice on the UI thread and the
 * per-frame path never touches React state.
 *
 * Extracted when the recording view wanted the same name in its corner as the
 * ribbon shows in the middle (INV-NOTES-137). Two copies of the MIDI-to-name
 * mapping would be two things to keep in step, and they would disagree at the
 * edges — where a name is hardest to read and matters most.
 */
import React, { useMemo } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue
} from 'react-native-reanimated';
import { NOTE_NAMES } from 'logic';

import { UNVOICED_MIDI } from './useRecordController';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** What is shown when nothing pitched is being sung. */
export const NO_NOTE = '—';

/** UI-thread MIDI → "C#4" label. Mirrors logic.frequencyToNote naming. */
export function midiToLabel(midi: number): string {
  'worklet';
  if (midi === UNVOICED_MIDI || midi < 0) {
    return NO_NOTE;
  }
  const rounded = Math.round(midi);
  const index = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[index]}${octave}`;
}

export interface NoteNameProps {
  sharedMidi: SharedValue<number>;
  /** Everything about how it looks. Two views want it at two sizes. */
  style?: TextStyle | TextStyle[];
  testID?: string;
}

export function NoteName({
  sharedMidi,
  style,
  testID
}: NoteNameProps): React.JSX.Element {
  const text = useDerivedValue(() => midiToLabel(sharedMidi.value), []);
  const animatedProps = useAnimatedProps(() => ({
    // `text` is a defaultProp of TextInput; setting it here mutates the native
    // view directly, bypassing React state.
    text: text.value,
    defaultValue: text.value
  }));
  const composed = useMemo(
    () => [styles.base, ...(Array.isArray(style) ? style : [style ?? {}])],
    [style]
  );

  return (
    <AnimatedTextInput
      testID={testID}
      editable={false}
      underlineColorAndroid="transparent"
      defaultValue={NO_NOTE}
      style={composed}
      animatedProps={animatedProps}
    />
  );
}

export default NoteName;

const styles = StyleSheet.create({
  base: { textAlign: 'center', padding: 0 }
});
