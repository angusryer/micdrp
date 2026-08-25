/**
 * Which tracks a note actually has (INT-NOTES-026).
 *
 * A control for a track that would make no sound is a control that lies, so
 * both the options list and the rail beside the graph ask this rather than
 * each working it out — two answers to one question drift the moment either
 * is edited.
 *
 * A track is offered when it has something to sound. The take is offered
 * always: every note has one.
 */
import { TRACKS, isAlwaysPresent, type TrackName } from './trackRegistry';

/** How long each track would run, 0 or absent where it has nothing. */
export type TrackDurations = Partial<Record<TrackName, number>>;

export function offeredTracks(durations: TrackDurations): TrackName[] {
  const offered = TRACKS.map((track) => track.name).filter(
    (name) => isAlwaysPresent(name) || (durations[name] ?? 0) > 0
  );
  // The take alone is not a choice. With nothing to turn, a list of one
  // control says less than no list at all.
  return offered.length > 1 ? offered : [];
}
