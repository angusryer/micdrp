/**
 * PlaybackBar — play/pause a note's captured audio.
 *
 * The view only. Decoding, the AudioContext lifecycle, and the URL-resolution
 * rules live in `usePlayback`, which this renders.
 *
 * The note detail view's player. The Notes list card does not use this: its own
 * play button is its player, so a bar there would be a second control for the
 * same take (INV-NOTES-015).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { useTheme } from '../../theme';
import { usePlayback } from './usePlayback';

export type { PlaybackState } from './usePlayback';

export interface PlaybackBarProps {
  /**
   * Produce a playable URL. Called when playback starts, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
  /** Optional override duration label (e.g. "1:23"). */
  durationLabel?: string;
}

export function PlaybackBar({
  resolveAudioUri,
  durationLabel
}: PlaybackBarProps) {
  const { colors } = useTheme();
  const { state, play, stop } = usePlayback({ resolveAudioUri });

  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const isError = state === 'error';

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary500}
          accessibilityLabel="Loading audio"
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityState={{ selected: isPlaying }}
          onPress={isPlaying ? stop : play}
          style={[
            styles.button,
            { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
          ]}
        >
          <Text style={[styles.buttonLabel, { color: colors.white }]}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </Pressable>
      )}

      {durationLabel != null ? (
        <Text style={[styles.duration, { color: colors.gray300 }]}>
          {durationLabel}
        </Text>
      ) : null}

      {isError ? (
        <Text style={[styles.error, { color: colors.error }]}>
          Playback failed
        </Text>
      ) : null}
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
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
  },
  duration: {
    fontSize: 13
  },
  error: {
    fontSize: 12
  }
});
