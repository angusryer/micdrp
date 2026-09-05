/**
 * The take, on the transport (INV-TPORT-001).
 *
 * What is left here is a binding: an engine below, a transport over it,
 * and the `Playback` shape everything above still expects. The state
 * machine, the cancellation, the refusal reporting and the moment all
 * moved into `audio/transportStore`, where they can be argued with in a
 * test rather than on a device.
 *
 * This file held all of that, and so did five of its neighbours. Each
 * read as correct on its own; the fault was that there were six.
 *
 * The recording is still decoded once into a slot on the native engine
 * and scheduled by the same call, on the same clock, at the same bus
 * levels as every synthesized voice (INV-NOTES-133) — that part is the
 * engine's, next door.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { createTransport } from '../../audio/transportStore';
import type { TransportState } from '../../audio/transportState';
import { useDrawnPosition, usePlaybackClock } from './usePlaybackClock';
import { useTakeEngine } from './useTakeEngine';
import type { Playback, PlaybackState, UsePlaybackOptions } from './playbackShape';

/** The transport's words, in the ones this contract still speaks. */
const asPlaybackState = (state: TransportState): PlaybackState => {
  if (state === 'playing' || state === 'loading') {
    return state;
  }
  return state === 'failed' ? 'error' : 'stopped';
};

export function useTakeVoice({ resolveAudioUri }: UsePlaybackOptions): Playback {
  const engine = useTakeEngine(resolveAudioUri);
  // Held in a ref so the transport is built once and always reaches the
  // current engine: rebuilding the transport would drop what it knows.
  const latest = useRef(engine);
  latest.current = engine;

  const transport = useMemo(
    () =>
      createTransport({
        start: (fromMs) => latest.current.start(fromMs),
        silence: () => latest.current.silence(),
        reachedMs: () => latest.current.reachedMs()
      }),
    []
  );

  const [snapshot, setSnapshot] = useState(() => transport.snapshot());
  useEffect(
    () => transport.subscribe(() => setSnapshot(transport.snapshot())),
    [transport]
  );

  const state = asPlaybackState(snapshot.state);
  const running = state === 'playing';
  const positionMs = usePlaybackClock(running, snapshot.cueMs);
  // The same moment, read every frame on the UI thread (INV-NOTES-136).
  const drawnPositionMs = useDrawnPosition(running, snapshot.cueMs);

  return {
    state,
    positionMs,
    drawnPositionMs,
    elapsedMs: engine.elapsedMs,
    durationMs: engine.durationMs(),
    setLevel: engine.setLevel,
    play: (fromMs) => transport.play(fromMs),
    stop: () => transport.stop(),
    // Resolves with the moment held, which is where the next press picks
    // up (INV-NOTES-152). The transport already knows it.
    pause: async () => {
      await transport.pause();
      return transport.snapshot().cueMs;
    }
  };
}
