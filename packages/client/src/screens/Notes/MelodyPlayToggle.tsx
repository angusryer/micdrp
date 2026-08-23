/**
 * MelodyPlayToggle — the melody's own transport, under the graph.
 *
 * The press that starts it is the press that stops it, and the glyph says
 * which one is on offer — a square rather than a pause, since what it ends
 * starts again from the top (INV-NOTES-067).
 *
 * Split out of HearItAs when the reading moved into the playback options: this
 * is the one thing there that makes a sound, and nothing in the options does
 * (INT-NOTES-021), so it stays beside the graph it plays. Which reading it
 * would sound is no longer written next to it, so it names it aloud instead.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { PlaybackMode } from 'logic';

import { useTheme } from '../../theme';
import { Icon } from '../../components/Icon';
import { hearingLabel } from './HearItAs';

/** Edge of the glyph on the play control, in px. */
const GLYPH = 15;

export interface MelodyPlayToggleProps {
  /** Whether the melody is sounding now, which is what the control reports. */
  isPlaying: boolean;
  /** The reading a press would sound, named for whoever cannot see the list. */
  mode: PlaybackMode;
  onPlay: () => void;
  /** Silence a melody already sounding, from the control that started it. */
  onStop: () => void;
}

export function MelodyPlayToggle({
  isPlaying,
  mode,
  onPlay,
  onStop
}: MelodyPlayToggleProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID="hear-play"
      accessibilityRole="button"
      accessibilityLabel={
        isPlaying
          ? 'Stop the melody'
          : `Play ${hearingLabel(mode).toLowerCase()}`
      }
      accessibilityState={{ selected: isPlaying }}
      onPress={isPlaying ? onStop : onPlay}
      style={[
        styles.play,
        { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
      ]}
    >
      <Icon name={isPlaying ? 'stop' : 'play'} size={GLYPH} color={colors.white} />
      <Text style={[styles.playText, { color: colors.white }]}>
        {isPlaying ? 'Stop melody' : 'Play melody'}
      </Text>
    </TouchableOpacity>
  );
}

export default MelodyPlayToggle;

const styles = StyleSheet.create({
  play: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playText: { fontSize: 15, fontWeight: '700' }
});
