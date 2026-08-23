/**
 * PlaybackOptionsButton — the control that opens the playback options sheet.
 *
 * A sliders glyph and no word (INV-NOTES-075). The transport it stands beside
 * is already wordless, so the label "Options" was the one thing on that row to
 * be read rather than recognised, and the widest thing on a row that also has
 * to fit a counter and a failure line.
 *
 * Not to be confused with PlaybackOptions.tsx, which is what the sheet holds.
 * This is only the door: it starts no sound and knows nothing about the mix.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';

/** Edge of the glyph, matching the transport's own (INV-NOTES-065). */
const GLYPH = 22;

export interface PlaybackOptionsButtonProps {
  onPress: () => void;
}

export function PlaybackOptionsButton({
  onPress
}: PlaybackOptionsButtonProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Playback options"
      onPress={onPress}
      // The drawing is smaller than a finger; the hit area is not.
      hitSlop={12}
      testID="playback-options"
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <View testID="playback-options-glyph">
        <Icon name="options" size={GLYPH} color={colors.primary500} />
      </View>
    </Pressable>
  );
}

export default PlaybackOptionsButton;

const styles = StyleSheet.create({
  // Pushed to the far end of the transport row, where the word used to sit.
  button: { padding: 6 }
});
