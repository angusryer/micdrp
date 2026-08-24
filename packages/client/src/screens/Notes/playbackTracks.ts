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
import { TRACKS, type TrackName } from './trackRegistry';

/**
 * Which tracks a press sounds. Each is turned on and off on its own.
 *
 * Derived from the registry rather than written out, so a track declared
 * there is a track the mixer already knows about (INV-NOTES-121).
 */
export type PlaybackMix = Record<TrackName, boolean>;

export type { TrackName };

/** How loud each track sits, 0..1. Separate from whether it is on at all. */
export type TrackLevels = Record<TrackName, number>;

const fromTracks = <T>(pick: (track: (typeof TRACKS)[number]) => T) =>
  Object.fromEntries(TRACKS.map((track) => [track.name, pick(track)])) as Record<
    TrackName,
    T
  >;

/**
 * What each track starts at.
 *
 * The take is the thing being judged, so it sits at full; the voices read
 * from it sit under it, or they argue with the performance instead of
 * describing it (INV-NOTES-082).
 */
export const DEFAULT_LEVELS: TrackLevels = fromTracks((t) => t.level);

/** What a note offers before anything is turned. */
export const DEFAULT_MIX: PlaybackMix = fromTracks((t) => t.startsOn);

/** What the options sheet calls each one. */
export const TRACK_TITLES: Record<TrackName, string> = fromTracks(
  (t) => t.title
);

/** Drawn in this order, and only for the tracks a note actually has. */
export const TRACK_ORDER: readonly TrackName[] = TRACKS.map(
  (track) => track.name
);

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

/**
 * The mix as it actually sounds, with tracks the note does not have removed.
 *
 * The take is always available — it is the recording, not a reading of it.
 * Everything else sounds only where the note has something for it to sound,
 * so a control can never claim a sound nothing makes (INT-NOTES-026).
 */
export function withOnlyAvailable(
  mix: PlaybackMix,
  available: readonly TrackName[]
): PlaybackMix {
  return fromTracks(
    (track) =>
      mix[track.name] &&
      (track.role === 'recording' || available.includes(track.name))
  );
}
