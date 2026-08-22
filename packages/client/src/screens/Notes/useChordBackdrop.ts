/**
 * useChordBackdrop — sound the chord track under a take while it plays.
 *
 * Pressing play on a note gives the singer the take *and* the harmony their
 * line implied, together. The whole progression is scheduled in one go on the
 * reference-tone player: every slot already carries its span on the same clock
 * the audio runs on — both are measured from the start of the capture — so
 * chords and take line up without a second clock between them.
 *
 * Each tone is quieter than an audition's: a backdrop has to be heard past a
 * voice, a tapped chord is heard on its own (INV-NOTES-009). The player is its
 * own AudioContext, separate from the tap/audition player, so tapping a note
 * or a chord during playback does not cut the backdrop off.
 */
import { useCallback, useEffect, useMemo } from 'react';

import type { ChordPlayback, TargetNote } from 'logic';

import {
  createTonePlayer,
  SynthBus,
  type SynthBusValue
} from '../../audio/synthPlayer';

/** Peak gain per backdrop tone — several sound at once, under the take. */
const BACKDROP_PEAK_GAIN = 0.06;

export interface ChordBackdrop {
  /**
   * Schedule the progression against the take. `offsetMs` is how far the take
   * has already run when the chords are handed over — a render and an audio
   * context after the audio began — so the harmony lands where the voice is
   * rather than that much behind it (INV-NOTES-020). 0 starts from the top,
   * which is what the chords sounded alone do.
   */
  start: (offsetMs?: number) => void;
  /** Silence it. Safe to call when nothing is sounding. */
  stop: () => void;
  /**
   * How long the whole backdrop runs, in ms; 0 when the melody implied no
   * chords. Played on its own the backdrop is the transport, and this is what
   * tells that transport when it has finished (INV-NOTES-018).
   */
  durationMs: number;
}

/** Flatten voiced slots into one tone per chord note, on the take's clock. */
export function backdropTones(
  progression: readonly ChordPlayback[]
): TargetNote[] {
  const tones: TargetNote[] = [];
  for (const chord of progression) {
    // A grid whose first bar line falls before the first sung note puts a slot
    // ahead of the take; clamp it rather than schedule it in the past.
    const startMs = Math.max(0, chord.startMs);
    if (chord.endMs <= startMs) {
      continue;
    }
    for (const midi of chord.midi) {
      tones.push({ midi, startMs, endMs: chord.endMs });
    }
  }
  return tones;
}

/**
 * Move tones from the take's clock onto a take already `offsetMs` in: what has
 * been passed is dropped, what is underway starts now and still ends where it
 * ended, and what is ahead keeps its place (INV-NOTES-020).
 */
export function shiftTones(
  tones: readonly TargetNote[],
  offsetMs: number
): TargetNote[] {
  if (offsetMs <= 0) {
    return [...tones];
  }
  const shifted: TargetNote[] = [];
  for (const tone of tones) {
    const endMs = tone.endMs - offsetMs;
    if (endMs <= 0) {
      continue;
    }
    const startMs = Math.max(0, tone.startMs - offsetMs);
    shifted.push({ ...tone, startMs, endMs });
  }
  return shifted;
}

/** Which voice this backdrop is, when it is not the chords themselves. */
export interface ChordBackdropOptions {
  bus?: SynthBusValue;
  peakGain?: number;
}

export function useChordBackdrop(
  progression: readonly ChordPlayback[],
  options: ChordBackdropOptions = {}
): ChordBackdrop {
  const { bus = SynthBus.Chords, peakGain = BACKDROP_PEAK_GAIN } = options;
  const player = useMemo(
    () => createTonePlayer(bus, { peakGain }),
    [bus, peakGain]
  );
  const tones = useMemo(() => backdropTones(progression), [progression]);
  const durationMs = useMemo(
    () => tones.reduce((end, tone) => Math.max(end, tone.endMs), 0),
    [tones]
  );

  // Leaving the screen mid-take must leave nothing sounding (INV-NOTES-018).
  useEffect(() => () => player.stop(), [player]);

  const start = useCallback(
    (offsetMs = 0) => player.play(shiftTones(tones, offsetMs)),
    [player, tones]
  );
  const stop = useCallback(() => player.stop(), [player]);

  // Stable while the track is, so the transport is not handed a fresh object
  // on every render of the screen around it.
  return useMemo(
    () => ({ start, stop, durationMs }),
    [start, stop, durationMs]
  );
}

export default useChordBackdrop;
