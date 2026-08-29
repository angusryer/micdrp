/**
 * When the audio itself started, and where the take will be by the time
 * something scheduled now actually sounds.
 *
 * Split from the clock that says how far in we are: that is a reading for the
 * eye, this is a reading for the scheduler, and they are wanted at different
 * moments by different callers.
 */
import { useMemo, useRef } from 'react';

import { SCHEDULE_LEAD_MS, audioNowMs } from '../../audio/audioClock';

/**
 * The instant the audio itself started, and where the take will be when
 * something scheduled now actually sounds.
 *
 * On the audio device's clock, not the wall clock. The synth schedules on the
 * engine's sample clock; a take anchored to `Date.now()` was being lined up
 * against a different clock entirely, and two clocks that are not the same
 * clock drift rather than differing by a constant (INV-NOTES-126).
 *
 * The lead is included on purpose. A voice scheduled now does not sound now —
 * it sounds a lead later, by which time the take has moved on — so the offset
 * a voice is given has to be where the take WILL be, not where it is.
 *
 * A ref, not state: the reader wants the value as it is when it asks, and
 * marking the anchor must not re-render the transport that just started.
 */
export interface TakeAnchor {
  /**
   * Record when the audio starts, on the audio clock.
   *
   * Given a moment, that moment; given none, now. A caller that scheduled the
   * take to begin at a known time in the future says so, and the anchor is
   * exact rather than an estimate taken beside the call (INV-NOTES-126).
   */
  mark: (atMs?: number) => void;
  /**
   * Where the take will be when something scheduled now actually sounds.
   *
   * 0 before the first mark. Includes the scheduling lead, because a voice
   * scheduled now sounds a lead later and the take will have moved on.
   */
  elapsedMs: () => number;
  /**
   * Where the take is sounding at this instant — the moment the ear is at.
   *
   * The same reading without the lead, which is the difference between
   * placing a voice that has yet to sound and naming the moment being heard.
   * What a pause keeps hold of (INV-NOTES-152).
   */
  reachedMs: () => number;
}

export function useTakeAnchor(): TakeAnchor {
  const startedAt = useRef<number | null>(null);
  return useMemo(
    () => ({
      mark: (atMs = audioNowMs()) => {
        startedAt.current = atMs;
      },
      elapsedMs: () =>
        startedAt.current === null
          ? 0
          : Math.max(0, audioNowMs() + SCHEDULE_LEAD_MS - startedAt.current),
      reachedMs: () =>
        startedAt.current === null
          ? 0
          : Math.max(0, audioNowMs() - startedAt.current)
    }),
    []
  );
}
