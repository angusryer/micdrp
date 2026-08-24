/**
 * Sound the detected melody over the take, so the two can be compared by ear.
 *
 * Hearing them apart tells you each is plausible; hearing them together tells
 * you whether they are the same. A note read a semitone out, or a beat late,
 * is obvious against the voice and easy to miss beside it (INV-NOTES-027).
 *
 * Its own player, and so its own AudioContext, separate from the chord
 * backdrop and from tap-to-audition: three things may sound at once and none
 * should cut another off.
 */
import { trackBus } from './trackRegistry';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { TargetNote } from 'logic';

import { createTonePlayer } from '../../audio/synthPlayer';
import { shiftTones } from './useChordBackdrop';

/**
 * Loud enough to hear over a voice at the default, quiet enough not to mask
 * it. The point is to compare, so neither should win by default.
 */
export const DEFAULT_MELODY_LEVEL = 0.5;

export interface MelodyBackdrop {
  /** Schedule the melody against a take already `offsetMs` in. */
  start: (offsetMs?: number) => void;
  stop: () => void;
  /** Mix it against the take, 0..1, while it is playing. */
  setLevel: (level: number) => void;
}

export function useMelodyBackdrop(
  tones: readonly TargetNote[],
  /**
   * Which bus it sounds on. Its own, for anything that is not the melody:
   * two voices on one bus share a level, so turning one down turns the other
   * down with it (INV-NOTES-119).
   */
  bus: number = trackBus('melody')
): MelodyBackdrop {
  const player = useMemo(() => createTonePlayer(bus), [bus]);
  const level = useRef(DEFAULT_MELODY_LEVEL);

  useEffect(() => {
    player.setLevel(level.current);
    return () => player.stop();
  }, [player]);

  return {
    start: useCallback(
      (offsetMs = 0) => {
        player.stop();
        if (tones.length === 0) {
          return;
        }
        // On the take's clock: both are measured from the start of the
        // capture, so what has already passed is dropped rather than played
        // late (INV-NOTES-020).
        player.play(shiftTones(tones, offsetMs));
      },
      [player, tones]
    ),
    stop: useCallback(() => player.stop(), [player]),
    setLevel: useCallback(
      (next: number) => {
        level.current = next;
        player.setLevel(next);
      },
      [player]
    )
  };
}
