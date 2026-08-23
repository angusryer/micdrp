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
  /**
   * A click counting the take in, so a second voice knows when to come in.
   * Off until asked for: it is a scaffold for recording against, not part of
   * the idea (INV-NOTES-088).
   */
  count: boolean;
  /** The detected melody over the take. Rides the take's clock, so it needs it. */
  melody: boolean;
}

export type TrackName = keyof PlaybackMix;

/** How loud each track sits, 0..1. Separate from whether it is on at all. */
export type TrackLevels = Record<TrackName, number>;

/**
 * What each track starts at.
 *
 * The take is the thing being judged, so it sits at full; the voices read
 * from it sit under it, or they argue with the performance instead of
 * describing it (INV-NOTES-082).
 */
export const DEFAULT_LEVELS: TrackLevels = {
  take: 1,
  chords: 0.7,
  melody: 0.6,
  // Faint. It is there to be followed, not listened to, and a loud click
  // over a quiet take is the take you stop hearing.
  count: 0.35
};

/** Drawn in this order, and only for the tracks a note actually has. */
export const TRACK_ORDER: readonly TrackName[] = [
  'take',
  'chords',
  'melody',
  'count'
];

/** What a note offers before anything is turned. */
export const DEFAULT_MIX: PlaybackMix = {
  take: true,
  chords: true,
  melody: false,
  count: false
};

/**
 * Whether a track's toggle is unavailable rather than merely off.
 *
 * One case now: turning off the last track that can sound, which would leave
 * a press with nothing to do.
 *
 * The melody used to be locked without a take under it, on the grounds that
 * it rides the take's clock. It has its own transport now — the melody read
 * from a take is worth hearing by itself, and the separate control that used
 * to do that has gone into this list, so locking it here would take the
 * ability away rather than move it (INT-NOTES-026).
 */
export function isTrackLocked(track: TrackName, mix: PlaybackMix): boolean {
  const sounding = TRACK_ORDER.filter((name) => mix[name]);
  return mix[track] && sounding.length === 1;
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
    // Sounds on its own now: the melody read from a take is worth hearing by
    // itself, and the control that used to do that has gone into this list
    // (INT-NOTES-026).
    melody: mix.melody && available.includes('melody'),
    count: mix.count && available.includes('count')
  };
}
