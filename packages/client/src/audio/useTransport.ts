/**
 * The transport, bound to React (INV-TPORT-003).
 *
 * Thin on purpose. The model is a store with no React in it, and this
 * is the whole of the binding: subscribe, read, and hand back the
 * commands unchanged. A control calls a command and renders what it is
 * told; it keeps no playback state of its own, because a control that
 * sets state is a second answer to "what is sounding" and two answers is
 * how a button came to show a pause glyph over a take that had stopped.
 *
 * `useSyncExternalStore` rather than an effect writing into state: it
 * subscribes and reads in one step, so there is no render in which the
 * component has mounted and does not yet know what is happening.
 *
 * The moment is not here at all. It rides the head on the UI thread, and
 * anything drawing it reads that (INV-TPORT-002).
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { Transport, TransportSnapshot } from './transportStore';

export interface UseTransport extends TransportSnapshot {
  play: (atMs?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (atMs: number) => void;
}

export function useTransport(transport: Transport): UseTransport {
  const snapshot = useSyncExternalStore(
    // Both stable for the life of the store, so subscribing never churns.
    useCallback((listener: () => void) => transport.subscribe(listener), [transport]),
    useCallback(() => transport.snapshot(), [transport])
  );

  return {
    ...snapshot,
    // Fired and forgotten. A command's answer is the next snapshot, not a
    // promise a control has to hold — and a control awaiting one is a
    // control with an opinion about what happens next.
    play: useCallback((atMs?: number) => void transport.play(atMs), [transport]),
    pause: useCallback(() => void transport.pause(), [transport]),
    stop: useCallback(() => void transport.stop(), [transport]),
    seek: useCallback((atMs: number) => void transport.seek(atMs), [transport])
  };
}
