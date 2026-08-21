/**
 * PlaybackButton — the transport control itself: play, pause, or a spinner
 * while the take is being fetched and decoded.
 *
 * Split from PlaybackBar so that bar is the arrangement — control, length,
 * failure line, and the choice of what sounds — rather than all of them at
 * once. The one press it offers is the same press in every state: this
 * control is the player, never a door to one (INV-NOTES-015).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme';
import type { PlaybackState } from './usePlayback';

export interface PlaybackButtonProps {
  state: PlaybackState;
  onPlay: () => void;
  onStop: () => void;
}

export function PlaybackButton({
  state,
  onPlay,
  onStop
}: PlaybackButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  const isPlaying = state === 'playing';

  if (state === 'loading') {
    return (
      <ActivityIndicator
        size="small"
        color={colors.primary500}
        accessibilityLabel="Loading audio"
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      accessibilityState={{ selected: isPlaying }}
      onPress={isPlaying ? onStop : onPlay}
      style={[
        styles.button,
        { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
      ]}
    >
      <Text style={[styles.buttonLabel, { color: colors.white }]}>
        {isPlaying ? 'Pause' : 'Play'}
      </Text>
    </Pressable>
  );
}

export default PlaybackButton;

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600'
  }
});
