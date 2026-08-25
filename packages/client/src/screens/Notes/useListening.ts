/**
 * How a particular note is being listened to, remembered with that note.
 *
 * Which tracks are on, how loud each sits, and which register the chords play
 * in were component state, so they lasted exactly as long as the screen did:
 * going back to a note you had spent time balancing gave you the defaults
 * again (INV-NOTES-114).
 *
 * Kept apart from the interpretation on purpose. An interpretation is what
 * somebody made of a take — the notes they corrected, the bars they arranged —
 * and it can be frozen, named and kept beside others. How loud you like the
 * chords is not a reading of the music, and freezing it into one would be a
 * category error. This is a local listening preference and stays local.
 */
import { useCallback, useEffect, useState } from 'react';

import { getJSON, setJSON } from '../../data/store';
import {
  DEFAULT_LEVELS,
  DEFAULT_MIX,
  type PlaybackMix,
  type TrackLevels,
  type TrackName
} from './playbackTracks';

/** The register the chords sound in, as a count of octaves above the floor. */
export const DEFAULT_CHORD_OCTAVES = 1;

export interface Listening {
  mix: PlaybackMix;
  levels: TrackLevels;
  chordOctaves: number;
  /**
   * Feel the beat rather than hear it.
   *
   * A click over a take competes with the thing it is there to help you
   * follow, and on a phone speaker it wins (INV-NOTES-125).
   */
  beatIsFelt: boolean;
}

const START: Listening = {
  mix: DEFAULT_MIX,
  levels: DEFAULT_LEVELS,
  chordOctaves: DEFAULT_CHORD_OCTAVES,
  beatIsFelt: false
};

const keyFor = (noteId: string) => `notes.${noteId}.listening`;

/**
 * Read what was kept for this note, filling anything absent from the defaults.
 *
 * Merged field by field rather than taken wholesale: a note balanced before a
 * track existed has no setting for it, and should get that track's default
 * rather than nothing at all.
 */
function read(noteId: string | null, startLevels: TrackLevels): Listening {
  const start: Listening = { ...START, levels: startLevels };
  if (noteId == null) {
    return start;
  }
  const kept = getJSON<Partial<Listening>>(keyFor(noteId));
  if (kept == null) {
    return start;
  }
  return {
    mix: { ...start.mix, ...kept.mix },
    levels: { ...start.levels, ...kept.levels },
    chordOctaves: kept.chordOctaves ?? start.chordOctaves,
    beatIsFelt: kept.beatIsFelt ?? start.beatIsFelt
  };
}

export interface UseListening extends Listening {
  setAudible: (track: TrackName, isAudible: boolean) => void;
  setLevel: (track: TrackName, level: number) => void;
  setChordOctaves: (octaves: number) => void;
  setBeatIsFelt: (felt: boolean) => void;
}

/**
 * @param startLevels Where this note's tracks sit before anybody moves them.
 *   Derived from how loud the take was actually sung (INV-NOTES-141); a level
 *   set by hand is kept and still wins.
 */
export function useListening(
  noteId: string | null,
  startLevels: TrackLevels = DEFAULT_LEVELS
): UseListening {
  const [listening, setListening] = useState<Listening>(() =>
    read(noteId, startLevels)
  );

  // A different note is a different balance. Read rather than carried over,
  // so opening a second note never inherits the first note's mix.
  useEffect(
    () => setListening(read(noteId, startLevels)),
    [noteId, startLevels]
  );

  const change = useCallback(
    (next: (was: Listening) => Listening) => {
      setListening((was) => {
        const now = next(was);
        if (noteId != null) {
          setJSON(keyFor(noteId), now);
        }
        return now;
      });
    },
    [noteId]
  );

  return {
    ...listening,
    setAudible: useCallback(
      (track, isAudible) =>
        change((was) => ({ ...was, mix: { ...was.mix, [track]: isAudible } })),
      [change]
    ),
    setLevel: useCallback(
      (track, level) =>
        change((was) => ({ ...was, levels: { ...was.levels, [track]: level } })),
      [change]
    ),
    setChordOctaves: useCallback(
      (chordOctaves) => change((was) => ({ ...was, chordOctaves })),
      [change]
    ),
    setBeatIsFelt: useCallback(
      (beatIsFelt) => change((was) => ({ ...was, beatIsFelt })),
      [change]
    )
  };
}
