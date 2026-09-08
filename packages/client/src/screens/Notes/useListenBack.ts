/**
 * Where a retimed note and a playable stretch are introduced to each other.
 *
 * The stretch knows nothing about notes and the take's transport knows nothing
 * about stretches; this is the one place that knows both, which is what keeps
 * the stretch reusable for a loop or a section to practise later
 * (INV-NOTES-178).
 */
import { useEffect, useMemo, useRef } from 'react';

import { usePlayRange, type PlayRangeState } from '../../components/usePlayRange';
import type { Chosen } from '../../components/graphSelection';

/** As much of the take's transport as a stretch needs. */
export interface SeekableTransport {
  seek: (ms: number) => void;
  play?: () => void;
  stop?: () => void;
}

export interface ListenBackOptions {
  transport?: SeekableTransport | null;
  /** How long the take runs, so a stretch cannot run off the end of it. */
  durationMs: number;
  /** The span of the last edit that changed when something happens. */
  retimed: { fromMs: number; toMs: number; nth: number } | null;
  /** What is chosen, because a stretch belongs to the edit that marked it. */
  selection: Chosen;
}

export function useListenBack({
  transport,
  durationMs,
  retimed,
  selection
}: ListenBackOptions): PlayRangeState {
  // The transport, adapted to the two verbs a stretch needs. Seeking and
  // starting are one act here; the stretch does not need to know they are two.
  const playable = useMemo(
    () =>
      transport?.play && transport.stop
        ? {
            play: (fromMs = 0) => {
              transport.seek(fromMs);
              transport.play?.();
            },
            stop: () => transport.stop?.()
          }
        : null,
    [transport]
  );

  const bounds = useMemo(
    () => ({ startMs: 0, endMs: durationMs }),
    [durationMs]
  );
  const range = usePlayRange(playable, bounds);

  /**
   * The two acts, always the current ones, never a reason to act again.
   *
   * Both are rebuilt whenever the transport is, and the transport carries the
   * state it is in — so it is a different object the moment anything is
   * playing. Listing them as dependencies ran both effects on every render:
   * mark the stretch, seek to it, play it, clear it, silence it, and again on
   * the render that caused. A take could not be played at all once a note had
   * been moved in time (INV-NOTES-225).
   */
  const acts = useRef(range);
  acts.current = range;

  // Once per retiming, which is what `nth` counts: the same note moved twice
  // is two edits and asks to be heard twice, while a redraw is neither.
  useEffect(() => {
    if (retimed) {
      acts.current.markAround(retimed.fromMs, retimed.toMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the retiming is
    // the fact; its span is read through the ref at the moment it is used.
  }, [retimed?.nth]);

  // A stretch belongs to the edit that marked it. Choosing something else is
  // moving on, and a mark left behind would be pointing at nothing.
  useEffect(() => {
    acts.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- what changed is
    // the selection. Clearing is how this reacts to it, not a dependency.
  }, [selection]);

  return range;
}
