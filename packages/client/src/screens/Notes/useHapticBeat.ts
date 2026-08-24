/**
 * The beat against the fingertip instead of in the ear.
 *
 * A click over a take is a click in the take: you hear it while listening to
 * what you sang, and on a phone speaker it competes with the very thing it is
 * there to help you follow. Felt instead of heard, it keeps time without
 * taking any of the room the music is in (INV-NOTES-125).
 *
 * Scheduled from the transport's own clock rather than driven by it. A tap
 * that fires when a position update happens to arrive would land wherever the
 * updates land — sixty times a second at best, and unevenly — so instead each
 * beat is booked ahead against the moment it is due.
 */
import { useEffect, useRef } from 'react';

import { committed, tapped } from '../../utilities/haptics';

/** One beat of the click, as the metronome laid them out. */
export interface Beat {
  startMs: number;
  /** Downbeats are struck harder, the way the sounded click accents them. */
  midi: number;
}

/** Past this far behind, a beat is missed rather than late (INV-NOTES-125). */
const TOO_LATE_MS = 60;

export interface HapticBeatOptions {
  beats: readonly Beat[];
  /** Where the take is now. Read once when playing starts, not followed. */
  positionMs: number;
  isPlaying: boolean;
  isOn: boolean;
}

export function useHapticBeat({
  beats,
  positionMs,
  isPlaying,
  isOn
}: HapticBeatOptions): void {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Read rather than depended on: a position that changed every frame would
  // rebook every beat every frame, which is the bug this shape avoids.
  const from = useRef(positionMs);
  from.current = positionMs;

  useEffect(() => {
    const clear = () => {
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
      timers.current = [];
    };
    clear();
    if (!isPlaying || !isOn || beats.length === 0) {
      return clear;
    }
    // The accent is whichever pitch the metronome used for its downbeats,
    // which is the higher of the two it produces (INV-NOTES-119).
    const accent = Math.max(...beats.map((beat) => beat.midi));
    const start = from.current;
    for (const beat of beats) {
      const wait = beat.startMs - start;
      // Beats already gone by are not fired late: a tap arriving after its
      // beat is worse than no tap, because it reads as the next one.
      if (wait < -TOO_LATE_MS) {
        continue;
      }
      timers.current.push(
        setTimeout(
          () => (beat.midi >= accent ? committed() : tapped()),
          Math.max(0, wait)
        )
      );
    }
    return clear;
    // Deliberately not `positionMs`: it moves constantly, and rebooking on
    // every tick would leave nothing booked long enough to fire.
  }, [beats, isPlaying, isOn]);
}

export default useHapticBeat;
