/**
 * Where a retimed note and a playable stretch are introduced to each other.
 *
 * The stretch knows nothing about notes and the take's transport knows nothing
 * about stretches; this is the one place that knows both, which is what keeps
 * the stretch reusable for a loop or a section to practise later
 * (INV-NOTES-178).
 */
import { useEffect, useMemo } from 'react';

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
  const { markAround, clear } = range;

  useEffect(() => {
    if (retimed) {
      markAround(retimed.fromMs, retimed.toMs);
    }
  }, [retimed, markAround]);

  // A stretch belongs to the edit that marked it. Choosing something else is
  // moving on, and a mark left behind would be pointing at nothing.
  useEffect(() => {
    clear();
  }, [selection, clear]);

  return range;
}
