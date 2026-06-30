/**
 * useAudioEngine — React hook over the {@link audioEngine} singleton.
 *
 * Surfaces only the coarse engine state to React (idle → recording → analyzing
 * → error); the per-frame `PitchSample` stream is delivered through `onPitch`,
 * which the caller is expected to route to a Reanimated shared value / Skia on
 * the UI thread — NOT into React state. All subscriptions registered through
 * this hook are torn down on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import audioEngine from './AudioEngine';
import {
  EngineConfig,
  EngineState,
  PitchSample,
  RecordingHandle
} from './contract';

export interface UseAudioEngine {
  /** Coarse engine state for rendering transport / status UI. */
  state: EngineState;
  start(): Promise<void>;
  stop(): Promise<RecordingHandle>;
  configure(config: Partial<EngineConfig>): Promise<void>;
  requestPermission(): Promise<boolean>;
  /**
   * Subscribe to the throttled live pitch stream. The returned unsubscribe is
   * also tracked by the hook and auto-invoked on unmount.
   */
  onPitch(cb: (sample: PitchSample) => void): () => void;
}

export function useAudioEngine(): UseAudioEngine {
  const [state, setState] = useState<EngineState>('idle');

  // Track every active unsubscribe so unmount tears them all down, even ones
  // the consumer forgot to release.
  const unsubsRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    const unsubs = unsubsRef.current;
    const off = audioEngine.onState((s) => setState(s));
    unsubs.add(off);
    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.clear();
    };
  }, []);

  const onPitch = useCallback((cb: (sample: PitchSample) => void): (() => void) => {
    const unsubs = unsubsRef.current;
    const raw = audioEngine.onPitch(cb);
    const wrapped = (): void => {
      raw();
      unsubs.delete(wrapped);
    };
    unsubs.add(wrapped);
    return wrapped;
  }, []);

  const start = useCallback((): Promise<void> => audioEngine.start(), []);
  const stop = useCallback((): Promise<RecordingHandle> => audioEngine.stop(), []);
  const configure = useCallback(
    (config: Partial<EngineConfig>): Promise<void> => audioEngine.configure(config),
    []
  );
  const requestPermission = useCallback(
    (): Promise<boolean> => audioEngine.requestPermission(),
    []
  );

  return { state, start, stop, configure, requestPermission, onPitch };
}

export default useAudioEngine;
