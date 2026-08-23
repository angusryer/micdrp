/**
 * The tracks a press sounds, and the rules about turning them.
 *
 * A note has up to three: the recorded take, the chord backdrop read from it,
 * and the melody read from it. Each is on or off on its own — three tracks
 * cannot be named by a single exclusive pick, and the melody over the take is
 * the pairing the whole reading is judged by, so it belongs here beside the
 * others rather than behind a switch of its own (INV-NOTES-019, INV-NOTES-027).
 *
 * Its own file so `usePlaybackMix` stays the transport and nothing else.
 */

/** Which tracks a press sounds. Each is turned on and off on its own. */
export interface PlaybackMix {
  take: boolean;
  chords: boolean;
  /** The detected melody over the take. Rides the take's clock, so it needs it. */
  melody: boolean;
}

export type TrackName = keyof PlaybackMix;

/** Drawn in this order, and only for the tracks a note actually has. */
export const TRACK_ORDER: readonly TrackName[] = ['take', 'chords', 'melody'];

/** What a note offers before anything is turned. */
export const DEFAULT_MIX: PlaybackMix = {
  take: true,
  chords: true,
  melody: false
};

/**
 * Whether a track's toggle is unavailable rather than merely off.
 *
 * Two cases, both of which would otherwise leave a control that does nothing:
 * turning off the last track that can sound, and turning the melody on with no
 * take under it — the melody rides the take's clock and is not a transport of
 * its own.
 */
export function isTrackLocked(track: TrackName, mix: PlaybackMix): boolean {
  if (track === 'melody') {
    return !mix.take;
  }
  const other = track === 'take' ? 'chords' : 'take';
  return mix[track] && !mix[other];
}

/** Whether two mixes have every track the same way round. */
export function sameMix(a: PlaybackMix, b: PlaybackMix): boolean {
  return TRACK_ORDER.every((track) => a[track] === b[track]);
}

/** The mix as it actually sounds, with tracks the note does not have removed. */
export function withOnlyAvailable(
  mix: PlaybackMix,
  available: readonly TrackName[]
): PlaybackMix {
  return {
    take: mix.take,
    chords: mix.chords && available.includes('chords'),
    // The melody rides the take, so it is silent without one however it is set.
    melody: mix.melody && mix.take && available.includes('melody')
  };
}
