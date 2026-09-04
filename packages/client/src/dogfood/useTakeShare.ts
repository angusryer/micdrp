/**
 * Whether this take is shared, and the two things that can change it.
 *
 * The state is read off the device first and shown at once, then checked
 * against the server. A row that waits for the network before saying
 * whether it offers to share or to withdraw is a row that gets tapped in
 * the wrong state, and every visit pays for it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { readingFingerprint, readingOf } from 'shared';

import { refreshShared, withdrawTake } from './sampleRecord';
import { lastShareError } from './sampleUpload';
import { shareTake, type ShareTakeInput } from './samples';
import { pendingShare, sharedTake, subscribeToShares } from './shares';

/**
 * What the control is showing.
 *
 * `stale` is shared, and read again since. It is a separate state rather
 * than a flag because it is a different offer: not "take it back" but
 * "share this reading too", which is what comparing a detector before and
 * against after needs (INV-DOG-034).
 */
export type TakeShareState = 'none' | 'pending' | 'shared' | 'stale';

export interface TakeShare {
  state: TakeShareState;
  /** When it was shared, or null. */
  sharedAtMs: number | null;
  /** Why the last attempt did not work, or null. */
  problem: string | null;
  /**
   * Why a share that is still queued has not gone yet, or null.
   *
   * Only ever set while pending. A queue that will not drain is invisible
   * from the outside — the take is on the device, the server has nothing,
   * and neither end can say why — so the reason the last send failed is
   * shown beside the state rather than kept in a log.
   */
  waitingBecause: string | null;
  isWorking: boolean;
  share: () => Promise<void>;
  withdraw: () => Promise<void>;
  /**
   * Forget the last refusal, once it has been shown.
   *
   * The control raises it rather than printing it, and an alert shown from
   * an effect would be raised again on every render until the thing that
   * triggered it is cleared.
   */
  clearProblem: () => void;
}

/**
 * Read the device's own answer. Synchronous, so the control never flickers.
 *
 * `hash` is the reading in front of the person right now; what is stored is
 * the reading that was shared. Different means the take has been read again
 * since, and there is something new to hand over.
 */
function localState(
  noteId: string,
  hash: string
): { state: TakeShareState; at: number | null } {
  const queued = pendingShare(noteId);
  if (queued != null) {
    return { state: 'pending', at: queued.sharedAtMs };
  }
  const shared = sharedTake(noteId);
  if (shared != null) {
    return {
      state: shared.readingHash === hash ? 'shared' : 'stale',
      at: shared.sharedAtMs
    };
  }
  return { state: 'none', at: null };
}

export function useTakeShare(input: ShareTakeInput | null): TakeShare {
  const noteId = input?.noteId ?? null;
  // The reading as it stands now, named the same way a sample names the one
  // it carries — so "has this been read again since it was shared" is one
  // string comparison rather than a diff of two melodies.
  const hash = useMemo(
    () =>
      input == null
        ? ''
        : readingFingerprint(readingOf(input.take, input.corrected)),
    [input]
  );
  const [local, setLocal] = useState(() =>
    noteId != null ? localState(noteId, hash) : { state: 'none' as const, at: null }
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const reread = useCallback(() => {
    if (noteId != null) {
      setLocal(localState(noteId, hash));
    }
  }, [noteId, hash]);

  // The device's answer for this take, then the server's. Both write the
  // same state, so a slow network only ever corrects what is already shown.
  useEffect(() => {
    if (noteId == null) {
      return;
    }
    setLocal(localState(noteId, hash));
    void refreshShared(noteId).then(() => setLocal(localState(noteId, hash)));
  }, [noteId, hash]);

  // The queue drains on its own — on launch, when a take ends, and a moment
  // after the tap that filled it. Without this the control would still say
  // "Sending…" long after the share arrived (INV-DOG-039).
  useEffect(() => subscribeToShares(reread), [reread]);

  const share = useCallback(async () => {
    if (input == null || isWorking) {
      return;
    }
    setIsWorking(true);
    setProblem(null);
    // A share that is queued but not yet sent is a success here: the tap
    // was the last thing to do about it. Only a refusal is worth saying;
    // an upload that has not gone yet is reported by the state instead.
    const refused = await shareTake(input).catch((error: unknown) => String(error));
    setProblem(refused);
    reread();
    setIsWorking(false);
  }, [input, isWorking, reread]);

  const withdraw = useCallback(async () => {
    if (noteId == null || isWorking) {
      return;
    }
    setIsWorking(true);
    setProblem(null);
    const refused = await withdrawTake(noteId).catch((error: unknown) =>
      String(error)
    );
    setProblem(refused);
    reread();
    setIsWorking(false);
  }, [noteId, isWorking, reread]);

  return {
    state: local.state,
    sharedAtMs: local.at,
    problem,
    waitingBecause: local.state === 'pending' ? lastShareError() : null,
    isWorking,
    share,
    withdraw,
    clearProblem: useCallback(() => setProblem(null), [])
  };
}
