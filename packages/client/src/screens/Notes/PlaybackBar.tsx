/**
 * PlaybackBar — play/pause a note, and turn the tracks playing it sounds.
 *
 * The view of a transport, plus the toggles that transport honours: the take,
 * the chord backdrop, the melody read from the take, each on or off on its own,
 * with the take and the chords on until they are turned (INV-NOTES-019). Only
 * the tracks the note has are offered, so a take that implied no chords and
 * carries no melody shows no toggles at all — there is nothing to turn. The
 * transport itself, the accompaniment's lifecycle, decoding and the
 * URL-resolution rules live in `usePlaybackMix` and `usePlayback`.
 *
 * The note detail view's player. The Notes list card does not use this: its own
 * play button is its player, so a bar there would be a second control for the
 * same take (INV-NOTES-015).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { PlaybackSheet } from './PlaybackSheet';
import { useTheme } from '../../theme';
import { PlaybackButton } from './PlaybackButton';
import { PlaybackMixToggle } from './PlaybackMixToggle';
import {
  DEFAULT_MIX,
  withOnlyAvailable,
  type PlaybackMix,
  type TrackName
} from './playbackTracks';
import { usePlaybackMix, type MixAccompaniment } from './usePlaybackMix';

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
  /**
   * The melody read out of the take. Its own track, sounding over the take on
   * the take's clock rather than following the chord track (INV-NOTES-027).
   */
  voice?: MixAccompaniment;
  /**
   * Anything else that decides what a press sounds, shown in the same sheet
   * as the tracks — the register the melody plays in, how loud it sits. Given
   * by the screen so this file never learns what an octave is.
   */
  options?: React.ReactNode;
}

export function PlaybackBar({
  resolveAudioUri,
  durationLabel,
  accompaniment,
  voice,
  options
}: PlaybackBarProps) {
  const { colors } = useTheme();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mix, setMix] = useState<PlaybackMix>(DEFAULT_MIX);
  // Only offer a track this note has. With neither chords nor a melody there
  // is nothing to turn, so the take is all there is and no toggles are shown.
  const offered = useMemo<TrackName[]>(() => {
    const extras: TrackName[] = [];
    if ((accompaniment?.durationMs ?? 0) > 0) {
      extras.push('chords');
    }
    if ((voice?.durationMs ?? 0) > 0) {
      extras.push('melody');
    }
    return extras.length > 0 ? ['take', ...extras] : [];
  }, [accompaniment?.durationMs, voice?.durationMs]);

  // What the toggles both draw and hand back: a track the note lacks, or a
  // melody with no take left under it, is off in fact, so drawing it on would
  // be the control claiming a sound nothing makes.
  const sounding = useMemo(
    () => withOnlyAvailable(mix, offered),
    [mix, offered]
  );
  const { state, play, stop, rewind } = usePlaybackMix({
    resolveAudioUri,
    mix: sounding,
    accompaniment,
    voice
  });

  return (
    <View style={styles.stack}>
      <View style={styles.container}>
        {/* Beside play rather than behind a gesture: a wrong note is judged by
            hearing it again, and that was costing the whole take
            (INT-NOTES-020). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back five seconds"
          onPress={() => void rewind()}
          hitSlop={8}
          style={({ pressed }) => [styles.rewind, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Icon name="rewind" size={20} color={colors.gray300} />
        </Pressable>
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

        <Text
          accessibilityRole="button"
          accessibilityLabel="Playback options"
          onPress={() => setIsSheetOpen(true)}
          style={[styles.options, { color: colors.primary500 }]}
        >
          Options
        </Text>
      </View>

      <PlaybackSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="What to play"
      >
        {offered.length > 0 ? (
          <PlaybackMixToggle
            value={sounding}
            onChange={setMix}
            offered={offered}
          />
        ) : null}
        {options}
      </PlaybackSheet>
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  rewind: { padding: 4, marginRight: 4 },
  options: { fontSize: 13, fontWeight: '600', marginLeft: 'auto' },
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
