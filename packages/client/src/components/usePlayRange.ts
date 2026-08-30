/**
 * Holding a stretch of a recording, and playing just that stretch.
 *
 * Takes the smallest thing that can sound one — start here, stop — so it can
 * drive the take's transport, a synthesized part, or anything else with those
 * two verbs. It knows nothing about what the stretch was marked around
 * (INV-NOTES-178).
 *
 * Stopping is on a timer rather than on a callback because nothing in the
 * audio path reports reaching a moment. The timer is cleared by anything that
 * supersedes it — a new stretch, a new play, the view going — so a stretch
 * cannot stop the playback that replaced it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  moveEdge,
  rangeAround,
  rangeLengthMs,
  type PlayRange,
  type RangeBounds,
  type RangeEdge
} from './playRange';

/** All this needs of a transport: start at a moment, and fall silent. */
export interface Playable {
  play: (fromMs?: number) => Promise<void> | void;
  stop: () => Promise<void> | void;
}

export interface PlayRangeState {
  /** The stretch, or null when none is marked. */
  range: PlayRange | null;
  /** Mark one around a span, with room either side, and play it once. */
  markAround: (fromMs: number, toMs: number) => void;
  /** Move one end of it. */
  moveEnd: (edge: RangeEdge, toMs: number) => void;
  /** Play it again from its start. */
  playRange: () => void;
  /** Take the mark away, silencing it if it is sounding. */
  clear: () => void;
  /** Whether the stretch is sounding now. */
  isPlaying: boolean;
}

export function usePlayRange(
  playable: Playable | null,
  bounds: RangeBounds
): PlayRangeState {
  const [range, setRange] = useState<PlayRange | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const endsAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelStop = useCallback(() => {
    if (endsAt.current) {
      clearTimeout(endsAt.current);
      endsAt.current = null;
    }
  }, []);

  const sound = useCallback(
    (playing: PlayRange) => {
      if (!playable) {
        return;
      }
      cancelStop();
      void playable.play(playing.fromMs);
      setIsPlaying(true);
      endsAt.current = setTimeout(() => {
        endsAt.current = null;
        setIsPlaying(false);
        void playable.stop();
      }, rangeLengthMs(playing));
    },
    [playable, cancelStop]
  );

  const markAround = useCallback(
    (fromMs: number, toMs: number) => {
      const marked = rangeAround(fromMs, toMs, bounds);
      setRange(marked);
      if (marked) {
        sound(marked);
      }
    },
    [bounds, sound]
  );

  const moveEnd = useCallback(
    (edge: RangeEdge, toMs: number) => {
      // Silent while an end is being moved: the stretch is being decided, and
      // deciding it against a recording that keeps restarting is harder than
      // deciding it in quiet.
      cancelStop();
      setIsPlaying(false);
      setRange((was) => (was ? moveEdge(was, edge, toMs, bounds) : was));
    },
    [bounds, cancelStop]
  );

  const playRange = useCallback(() => {
    if (range) {
      sound(range);
    }
  }, [range, sound]);

  const clear = useCallback(() => {
    cancelStop();
    setIsPlaying(false);
    setRange(null);
    void playable?.stop();
  }, [cancelStop, playable]);

  // The view going takes the timer with it, or a stretch stops a playback
  // begun after the screen was left.
  useEffect(() => cancelStop, [cancelStop]);

  return { range, markAround, moveEnd, playRange, clear, isPlaying };
}
