/**
 * The detail view's preview voice — the melody read from a take, a tapped
 * note, a tapped chord.
 *
 * One player for the three of them, because they are three ways of asking the
 * same question and hearing two answers at once answers neither. That makes
 * the melody stoppable: a press starts it, the same press stops it, and it
 * puts itself away when the melody runs out, when the reading beside it
 * changes, when a tap takes the voice, or when the view goes (INV-NOTES-031).
 *
 * Separate from `useMelodyBackdrop`, which sounds the same melody *over* the
 * take on the take's own clock and so needs its own context (INV-NOTES-027).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TargetNote } from 'logic';

import { createReferenceTonePlayer } from '../../audio/referenceTone';

export interface TonePreview {
  /** True only while the melody started from its own control is sounding. */
  isPlaying: boolean;
  /** Start the melody. */
  play: () => void;
  /** Stop it, whether it was the singer's doing or the melody's own end. */
  stop: () => void;
  /**
   * Sound something else through the same voice — a note, a chord. Silences
   * the melody first, so the control never claims to be playing something
   * that was cut off.
   */
  playTones: (tones: readonly TargetNote[]) => void;
}

/** How long the melody runs; 0 when there is nothing to sound. */
function durationOf(tones: readonly TargetNote[]): number {
  return tones[tones.length - 1]?.endMs ?? 0;
}

export function useTonePreview(melody: readonly TargetNote[]): TonePreview {
  const player = useMemo(() => createReferenceTonePlayer(), []);
  const [isPlaying, setIsPlaying] = useState(false);

  // The melody has no callback when it ends, so its length is the clock: the
  // control has to stop offering stop at the moment there is nothing left to
  // stop.
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearEndTimer = useCallback(() => {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearEndTimer();
    player.stop();
    setIsPlaying(false);
  }, [clearEndTimer, player]);

  const play = useCallback(() => {
    const durationMs = durationOf(melody);
    if (durationMs <= 0) {
      return;
    }
    clearEndTimer();
    player.play(melody);
    setIsPlaying(true);
    endTimer.current = setTimeout(() => setIsPlaying(false), durationMs);
  }, [clearEndTimer, melody, player]);

  const playTones = useCallback(
    (tones: readonly TargetNote[]) => {
      clearEndTimer();
      setIsPlaying(false);
      player.play(tones);
    },
    [clearEndTimer, player]
  );

  // Silence on the way out, and whenever the melody the control would sound
  // is no longer the melody it is sounding — choosing the written reading
  // mid-play would otherwise leave the take's own pitches running under a
  // control that now means something else.
  useEffect(() => stop, [melody, stop]);

  return { isPlaying, play, stop, playTones };
}

export default useTonePreview;
