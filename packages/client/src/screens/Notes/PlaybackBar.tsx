/**
 * PlaybackBar — play/pause a note, and choose what playing it sounds.
 *
 * The view of a transport, plus the choice that transport honours: the take
 * alone, the chord backdrop alone, or both, which is what a note offers until
 * something else is chosen (INV-NOTES-019). The choice only appears when there
 * are chords to choose — a melody that implied none offers no decision. The
 * transport itself, the accompaniment's lifecycle, decoding and the
 * URL-resolution rules live in `usePlaybackMix` and `usePlayback`.
 *
 * The note detail view's player. The Notes list card does not use this: its own
 * play button is its player, so a bar there would be a second control for the
 * same take (INV-NOTES-015).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { PlaybackButton } from './PlaybackButton';
import { PlaybackMixToggle } from './PlaybackMixToggle';
import {
  usePlaybackMix,
  type MixAccompaniment,
  type PlaybackMix
} from './usePlaybackMix';

export type { PlaybackState } from './usePlayback';
export type { PlaybackMix };

export interface PlaybackBarProps {
  /**
   * Produce a playable URL. Called when playback starts, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
  /** Optional override duration label (e.g. "1:23"). */
  durationLabel?: string;
  /**
   * The note's chord backdrop. Sounds with the take, or on its own when the
   * chords are what was chosen, and is silenced whenever the transport is not
   * playing — including when a take ends by itself or fails to decode
   * (INV-NOTES-018).
   */
  accompaniment?: MixAccompaniment;
  /** Follows the take itself rather than the chord choice. */
  voice?: MixAccompaniment;
}

export function PlaybackBar({
  resolveAudioUri,
  durationLabel,
  accompaniment,
  voice
}: PlaybackBarProps) {
  const { colors } = useTheme();
  const [mix, setMix] = useState<PlaybackMix>('both');
  // Nothing to choose between without chords, so the take is all there is.
  const hasChords = (accompaniment?.durationMs ?? 0) > 0;
  const { state, play, stop } = usePlaybackMix({
    resolveAudioUri,
    mix: hasChords ? mix : 'take',
    accompaniment,
    voice
  });

  return (
    <View style={styles.stack}>
      <View style={styles.container}>
        <PlaybackButton
          state={state}
          onPlay={() => void play()}
          onStop={() => void stop()}
        />

        {durationLabel != null ? (
          <Text style={[styles.duration, { color: colors.gray300 }]}>
            {durationLabel}
          </Text>
        ) : null}

        {state === 'error' ? (
          <Text style={[styles.error, { color: colors.error }]}>
            Playback failed
          </Text>
        ) : null}
      </View>

      {hasChords ? <PlaybackMixToggle value={mix} onChange={setMix} /> : null}
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  stack: { gap: 8 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  duration: {
    fontSize: 13
  },
  error: {
    fontSize: 12
  }
});
