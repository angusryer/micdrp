/**
 * What the singer calls this take, edited in place (INV-NOTES-272).
 *
 * Two taps turn it into something to type in, and leaving it keeps what
 * was typed. From the take rather than from a menu somewhere: a name is
 * the one thing on this screen that is already text, and editing text in
 * place is the gesture every other app has taught. Two taps rather than
 * one, because one tap on a title is how a person reads it.
 *
 * An empty name is refused and the old one stands: a take with nothing to
 * call it cannot be found again.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export interface NoteTitleProps {
  title: string;
  onRename: (title: string) => void;
  style?: StyleProp<TextStyle>;
}

export function NoteTitle({
  title,
  onRename,
  style
}: NoteTitleProps): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null);

  const begin = useCallback(() => setEditing(title), [title]);

  const twoTaps = useMemo(
    () =>
      Gesture.Tap()
        .withTestId('note-title-tap')
        .numberOfTaps(2)
        .onEnd(() => runOnJS(begin)()),
    [begin]
  );

  /**
   * Taken from the field rather than from state.
   *
   * The blur and the last keystroke can land in one batch, and a settle
   * closing over `editing` then keeps what was typed a moment ago
   * instead of what is there — so the name is read off the thing the
   * person was looking at.
   */
  const settle = useCallback(
    (typed: string) => {
      const wanted = typed.trim();
      setEditing(null);
      if (wanted.length > 0 && wanted !== title) {
        onRename(wanted);
      }
    },
    [title, onRename]
  );

  if (editing != null) {
    return (
      <TextInput
        accessibilityLabel="The name of this take"
        testID="note-title-input"
        value={editing}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onChangeText={setEditing}
        // Leaving it keeps what was typed — by tapping away, or by
        // saying done. Both are the same act.
        // React Native types a blur's event without the field's text even
        // though it carries it, so the value is read off the event and
        // falls back to what was last typed.
        onBlur={(e) =>
          settle(
            (e.nativeEvent as unknown as { text?: string }).text ?? editing
          )
        }
        onSubmitEditing={(e) => settle(e.nativeEvent.text)}
        style={[style, styles.input]}
      />
    );
  }

  return (
    <GestureDetector gesture={twoTaps}>
      <Text
        accessibilityRole="header"
        accessibilityHint="Tap twice to rename this take"
        testID="note-title"
        style={style}
      >
        {title}
      </Text>
    </GestureDetector>
  );
}

export default NoteTitle;

const styles = StyleSheet.create({
  // Nothing but a cursor: the name stays the size it was being read at,
  // so editing it does not move the page under the finger.
  input: { padding: 0, margin: 0 }
});
