/**
 * Whether this take is shared, and the two things that can change it.
 *
 * The state is read off the device first and shown at once, then checked
 * against the server. A row that waits for the network before saying
 * whether it offers to share or to withdraw is a row that gets tapped in
 * the wrong state, and every visit pays for it.
 */
import { useCallback, useEffect, useState } from 'react';

import { refreshShared, withdrawTake } from './sampleRecord';
import { lastShareError } from './sampleUpload';
import { shareTake, type ShareTakeInput } from './samples';
import { pendingShare, sharedTake } from './shares';

/** What the row is showing. */
export type TakeShareState = 'none' | 'pending' | 'shared';

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
}

/** Read the device's own answer. Synchronous, so the row never flickers. */
function localState(noteId: string): { state: TakeShareState; at: number | null } {
  const shared = sharedTake(noteId);
  if (shared != null) {
    return { state: 'shared', at: shared.sharedAtMs };
  }
  const queued = pendingShare(noteId);
  return queued != null
    ? { state: 'pending', at: queued.sharedAtMs }
    : { state: 'none', at: null };
}

export function useTakeShare(input: ShareTakeInput | null): TakeShare {
  const noteId = input?.noteId ?? null;
  const [local, setLocal] = useState(() =>
    noteId != null ? localState(noteId) : { state: 'none' as const, at: null }
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const reread = useCallback(() => {
    if (noteId != null) {
      setLocal(localState(noteId));
    }
  }, [noteId]);

  // The device's answer for this take, then the server's. Both write the
  // same state, so a slow network only ever corrects what is already shown.
  useEffect(() => {
    if (noteId == null) {
      return;
    }
    setLocal(localState(noteId));
    void refreshShared(noteId).then(() => setLocal(localState(noteId)));
  }, [noteId]);

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
    withdraw
  };
}
