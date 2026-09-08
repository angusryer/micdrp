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
import { type SharedValue } from 'react-native-reanimated';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlaybackSheet } from './PlaybackSheet';
import { useTheme } from '../../theme';
import { offeredTracks } from './offeredTracks';
import { useListening, type UseListening } from './useListening';
import { useHapticBeat } from './useHapticBeat';
import { GlyphGuideSheet } from './GlyphGuideSheet';
import { TrackCard } from './TrackCard';
import { IconToggle } from './IconToggle';
import {
  TRACK_TITLES,
  isTrackLocked,
  withOnlyAvailable,
  type PlaybackMix,
  type TrackName
} from './playbackTracks';

import { usePlaybackMix, type MixAccompaniment } from './usePlaybackMix';

export type { PlaybackState } from './usePlayback';
import type { PlaybackState } from './usePlayback';
export type { PlaybackMix };

export interface PlaybackBarProps {
  /**
   * Produce a playable URL. Called when playback starts, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
  /**
   * How this note is being listened to, and how to change it. Given, the
   * balance is kept with the note; absent, it lasts as long as the bar does.
   */
  listening?: UseListening;

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
  /** The click counting the take in (INV-NOTES-088). */
  count?: MixAccompaniment;
  /** The struck sounds read out of the take (INV-NOTES-120). */
  rhythm?: MixAccompaniment;
  /** The layers, as they were sung rather than as read (INV-NOTES-134). */
  layers?: MixAccompaniment;
  /** The root movement read from the take (INV-NOTES-135). */
  bass?: MixAccompaniment;
  /** The beats, for feeling rather than hearing them (INV-NOTES-125). */
  beats?: readonly { startMs: number; midi: number }[];
  /**
   * Whether the options sheet is open, where somebody else owns that.
   *
   * The control that opens it moved to the rail beside the graph, which this
   * component cannot see (INV-NOTES-142).
   */
  /**
   * How much the take is lifted to sit with the tracks read from it
   * (INV-NOTES-141). Measured from the take; 1 leaves it as recorded.
   */
  takeMakeUp?: number;
  /** How loud the take was sung, in dBFS, or null where nothing measured it. */
  sungDb?: number | null;
  isOptionsOpen?: boolean;
  onOptionsOpen?: (open: boolean) => void;
  /**
   * Anything else that decides what a press sounds — or how the take is read
   * while it does — shown in the same list as the tracks: which reading is
   * heard and which is drawn, the register the melody plays in, how loud it
   * sits. Given by the screen so this file never learns what an octave is.
   */
  /** The controls belonging to one track, drawn inside that track's card. */
  trackOptions?: (track: TrackName) => React.ReactNode;
  /**
   * Hands the transport to whatever else needs it — the scrubber above the
   * graph reads the position and sets it (INT-NOTES-022). Reported rather
   * than lifted, so this file stays the transport and the screen stays
   * composition.
   */
  onTransport?: (transport: {
    /**
     * The moment, read every frame on the UI thread (INV-NOTES-136).
     *
     * The only shape it comes in. A number that ticks was published here
     * too, and it re-rendered the screen above this one twice a second
     * (INV-NOTES-206).
     */
    drawnPositionMs: SharedValue<number>;
    /**
     * Whether a sound is actually running. A beat tapped against a stopped
     * take has no moment to be at (INV-NOTES-130).
     */
    isPlaying: boolean;
    seek: (ms: number) => void;
    /**
     * Taking hold of the head and putting it down again (INV-TPORT-018).
     *
     * A continuous gesture sends these two rather than a seek per frame,
     * so a drag is one transport command instead of sixty a second.
     */
    grabHead: () => void;
    dropHead: (ms: number) => void;
    /** Start the take, so a layer can be sung against it (INT-NOTES-025). */
    play: () => void;
    stop: () => void;
    /**
     * What the rail's copy of this control needs to be the same control
     * rather than a second one: the state it draws, and the two presses
     * that are not stop (INV-NOTES-227).
     */
    state: PlaybackState;
    pause: () => void;
    rewind: () => void;
  }) => void;
}

export function PlaybackBar({
  resolveAudioUri,
  accompaniment,
  voice,
  count,
  rhythm,
  layers,
  bass,
  takeMakeUp = 1,
  sungDb = null,
  isOptionsOpen,
  onOptionsOpen,
  beats = [],
  trackOptions,
  onTransport,
  listening
}: PlaybackBarProps) {
  const { colors } = useTheme();
  // Held by the caller where there is one: the control that opens this sits
  // on the graph's own edge now, which is a different component entirely
  // (INV-NOTES-142).
  const [isOwnSheetOpen, setIsOwnSheetOpen] = useState(false);
  const isSheetOpen = isOptionsOpen ?? isOwnSheetOpen;
  const setIsSheetOpen = onOptionsOpen ?? setIsOwnSheetOpen;
  const [explaining, setExplaining] = useState<TrackName | null>(null);
  // Held by the note rather than by this bar, so a balance survives leaving
  // the screen (INV-NOTES-114). Falls back to its own state where no note
  // owns it — the dogfood player has no note to keep it with.
  const own = useListening(null);
  const { mix, levels, setLevel, setAudible, beatIsFelt, setBeatIsFelt } =
    listening ?? own;
  // Only offer a track this note has. With neither chords nor a melody there
  // is nothing to turn, so the take is all there is and no toggles are shown.
  const offered = useMemo<TrackName[]>(
    () =>
      offeredTracks({
        chords: accompaniment?.durationMs,
        bass: bass?.durationMs,
        melody: voice?.durationMs,
        rhythm: rhythm?.durationMs,
        count: count?.durationMs,
        layers: layers?.durationMs
      }),
    [
      accompaniment?.durationMs,
      bass?.durationMs,
      voice?.durationMs,
      rhythm?.durationMs,
      count?.durationMs,
      layers?.durationMs
    ]
  );

  // What the toggles both draw and hand back: a track the note lacks, or a
  // melody with no take left under it, is off in fact, so drawing it on would
  // be the control claiming a sound nothing makes.
  const sounding = useMemo(
    () => withOnlyAvailable(mix, offered),
    [mix, offered]
  );
  const {
    state,
    problem,
    play,
    pause,
    stop,
    rewind,
    positionMs,
    drawnPositionMs,
    cueTo,
    grabHead,
    dropHead
  } =
    usePlaybackMix({
      resolveAudioUri,
      mix: sounding,
      levels,
      accompaniment,
      voice,
      count,
      rhythm,
      layers,
      bass,
      voices: listening?.voices ?? own.voices,
      takeMakeUp
    });

  // The click, felt instead of heard, when the note was left that way. It
  // rides the same clicks the sounded metronome uses, so the two can never
  // disagree about where a beat is (INV-NOTES-125).
  useHapticBeat({
    beats,
    positionMs,
    isPlaying: state === 'playing',
    isOn: sounding.count && beatIsFelt
  });

  useEffect(
    () =>
      onTransport?.({
        drawnPositionMs,
        // Whether a sound is actually running, not merely whether there is a
        // transport. A beat tapped against a stopped take has no moment to be
        // at (INV-NOTES-130).
        isPlaying: state === 'playing',
        // Moving the head, not a transport command (INV-NOTES-091).
        seek: cueTo,
        grabHead,
        dropHead,
        play: () => void play(),
        stop: () => void stop(),
        // What the rail's copy of this needs to be the same control rather
        // than a second one: the state it draws, and the two presses that
        // are not stop (INV-NOTES-227).
        state,
        pause: () => void pause(),
        rewind: () => void rewind()
      }),
    // Deliberately without `positionMs`. It changes twice a second while a
    // take runs, and publishing it re-rendered the whole screen above this
    // — graph, neck and chord track — faster than that screen could draw,
    // so the JS thread never went idle and a press had nowhere to be
    // handled (INV-NOTES-206). The moment reaches the displays as a shared
    // value the UI thread advances instead.
    [
      onTransport,
      drawnPositionMs,
      state,
      cueTo,
      grabHead,
      dropHead,
      play,
      pause,
      rewind,
      stop
    ]
  );

  return (
    <View style={styles.stack}>
      {/* All that is left above the graph. The transport moved to the foot of
          the rail, where the graph is (INV-NOTES-227) — but a command the
          engine will not take must never read as a control that did nothing,
          and the rail is 38 points wide with no room for a sentence
          (INV-TPORT-006). */}
      {state === 'error' ? (
        <View style={styles.container}>
          {/* What went wrong, not that something did. A take whose audio was
              never uploaded and one that will not decode are two different
              problems with two different remedies. */}
          <Text style={[styles.error, { color: colors.error }]}>
            {problem ?? 'Playback failed'}
          </Text>
        </View>
      ) : null}


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
            level={levels[track]}
            onLevelChange={(level) => setLevel(track, level)}
            isAudible={sounding[track]}
            onAudibleChange={(on) => setAudible(track, on)}
            isLocked={isTrackLocked(track, sounding)}
            onExplain={() => setExplaining(track)}
          >
            {/* The click is the one track worth feeling rather than hearing:
                over a take it competes with the thing it is helping you
                follow (INV-NOTES-125). */}
            {track === 'count' ? (
              <IconToggle
                icon="metronome"
                offIcon="speaker"
                isOn={beatIsFelt}
                onChange={setBeatIsFelt}
                label={
                  beatIsFelt ? 'Hear the beat instead' : 'Feel the beat instead'
                }
                testID="beat-is-felt"
              />
            ) : null}
            {trackOptions?.(track)}
          </TrackCard>
        ))}
      </PlaybackSheet>

      {/* Where the words went, now that the controls are glyphs
          (INV-NOTES-086). */}
      <GlyphGuideSheet
        track={explaining}
        onClose={() => setExplaining(null)}
        measured={{ sungDb, takeMakeUp }}
      />
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  details: { padding: 6 },
  stack: { gap: 8 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  error: {
    fontSize: 12
  }
});
