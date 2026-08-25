/**
 * Collecting a tapped rhythm and keeping it with the note.
 *
 * Each press is stamped against where the take has reached, not against the
 * wall clock, so a tapped hit lands on the same timeline as everything else
 * sounding (INV-NOTES-126). The position is read at the press rather than
 * followed, because a rhythm is placed by when the finger landed and nothing
 * else.
 *
 * Kept as its own list until it is committed, so a pass can be thrown away
 * without touching what was read from the take (INV-NOTES-129).
 */
import { useCallback, useState } from 'react';

import { hitsFromTaps, mergeHits, type Hit, type HitKind, type Tap } from 'logic';

export interface UseTappedRhythm {
  /** What has been tapped in this pass, as hits. */
  hits: Hit[];
  count: number;
  /** Lay one down at the moment given. */
  tap: (kind: HitKind, atMs: number) => void;
  /** Throw the pass away. */
  clear: () => void;
  /** Everything struck: what was tapped, over what was read. */
  merged: (detected: readonly Hit[]) => Hit[];
}

export function useTappedRhythm(): UseTappedRhythm {
  const [taps, setTaps] = useState<Tap[]>([]);

  const tap = useCallback((kind: HitKind, atMs: number) => {
    setTaps((was) => [...was, { kind, atMs }]);
  }, []);

  const clear = useCallback(() => setTaps([]), []);

  // Unsnapped. A tap is already exact, and rounding it is a claim about what
  // was meant rather than about when it happened — offered, not assumed.
  const hits = hitsFromTaps(taps);

  return {
    hits,
    count: hits.length,
    tap,
    clear,
    merged: useCallback(
      (detected: readonly Hit[]) => mergeHits(detected, hitsFromTaps(taps)),
      [taps]
    )
  };
}

export default useTappedRhythm;
