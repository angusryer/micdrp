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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { PlaybackSheet } from './PlaybackSheet';
import { useTheme } from '../../theme';
import { PlaybackButton } from './PlaybackButton';
import { TrackCard } from './TrackCard';
import { PlaybackOptionsButton } from './PlaybackOptionsButton';
import {
  DEFAULT_LEVELS,
  DEFAULT_MIX,
  isTrackLocked,
  withOnlyAvailable,
  type PlaybackMix,
  type TrackLevels,
  type TrackName
} from './playbackTracks';

/** What each track is called, in the singer's terms rather than the code's. */
const TRACK_TITLES: Record<TrackName, string> = {
  take: 'Your take',
  chords: 'Chords read from it',
  melody: 'Melody read from it'
};

const TRACK_HINTS: Record<TrackName, string> = {
  take: 'The recording itself',
  chords: 'The harmony your line implies, with its root underneath',
  melody: 'What the detector heard you sing'
};
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
   * Anything else that decides what a press sounds — or how the take is read
   * while it does — shown in the same list as the tracks: which reading is
   * heard and which is drawn, the register the melody plays in, how loud it
   * sits. Given by the screen so this file never learns what an octave is.
   */
  /** The controls belonging to one track, drawn inside that track's card. */
  trackOptions?: (track: TrackName) => React.ReactNode;
  /** Open the note's details. Sits beside the options, being its neighbour
      in kind: both open a sheet and neither makes a sound. */
  onDetails?: () => void;
  /**
   * Hands the transport to whatever else needs it — the scrubber above the
   * graph reads the position and sets it (INT-NOTES-022). Reported rather
   * than lifted, so this file stays the transport and the screen stays
   * composition.
   */
  onTransport?: (transport: {
    positionMs: number;
    seek: (ms: number) => void;
    /** Start the take, so a layer can be sung against it (INT-NOTES-025). */
    play: () => void;
    stop: () => void;
  }) => void;
}

export function PlaybackBar({
  resolveAudioUri,
  durationLabel,
  accompaniment,
  voice,
  trackOptions,
  onDetails,
  onTransport
}: PlaybackBarProps) {
  const { colors } = useTheme();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mix, setMix] = useState<PlaybackMix>(DEFAULT_MIX);
  const [levels, setLevels] = useState<TrackLevels>(DEFAULT_LEVELS);
  const setLevel = useCallback(
    (track: TrackName, level: number) =>
      setLevels((current) => ({ ...current, [track]: level })),
    []
  );
  const setAudible = useCallback(
    (track: TrackName, isAudible: boolean) =>
      setMix((current) => ({ ...current, [track]: isAudible })),
    []
  );
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
  const { state, play, stop, rewind, positionMs } = usePlaybackMix({
    resolveAudioUri,
    mix: sounding,
    levels,
    accompaniment,
    voice
  });

  // Dragging stops what is sounding and starts again where the finger left
  // it, rather than scrubbing through the audio: one press of play per
  // destination is what the transport can actually do.
  const seek = useCallback(
    async (ms: number) => {
      await stop();
      await play(ms);
    },
    [stop, play]
  );

  useEffect(
    () =>
      onTransport?.({
        positionMs,
        seek: (ms) => void seek(ms),
        play: () => void play(),
        stop: () => void stop()
      }),
    [onTransport, positionMs, seek, play, stop]
  );

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

        {/* The two that open a sheet, together at the far end: neither makes
            a sound, which is what separates them from the transport. */}
        <View style={styles.sheetOpeners}>
          {onDetails ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notes and analysis"
              onPress={onDetails}
              hitSlop={8}
              style={({ pressed }) => [styles.details, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Icon name="details" size={20} color={colors.gray300} />
            </Pressable>
          ) : null}
          <PlaybackOptionsButton onPress={() => setIsSheetOpen(true)} />
        </View>
      </View>

      <PlaybackSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="What to play, what to show"
      >
        {/* One card per thing that can sound, each with the same level and
            speaker in the same place, so the eye learns one shape
            (INV-NOTES-082). */}
        {offered.map((track) => (
          <TrackCard
            key={track}
            title={TRACK_TITLES[track]}
            hint={TRACK_HINTS[track]}
            level={levels[track]}
            onLevelChange={(level) => setLevel(track, level)}
            isAudible={sounding[track]}
            onAudibleChange={(on) => setAudible(track, on)}
            isLocked={isTrackLocked(track, sounding)}
          >
            {trackOptions?.(track)}
          </TrackCard>
        ))}
      </PlaybackSheet>
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  rewind: { padding: 4, marginRight: 4 },
  sheetOpeners: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  details: { padding: 6 },
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
