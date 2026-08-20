/**
 * usePlayback — the audio machine behind PlaybackBar.
 *
 * Split out of PlaybackBar.tsx so the view stays a view. Decodes and plays a
 * note's audio URI through react-native-audio-api's `AudioContext`. State is
 * local to one caller and entirely separate from the live recording path.
 *
 * The URL is produced by a resolver called at the moment Play is pressed,
 * never before. A note served from the backend needs a token that lives about
 * two minutes, so a URL obtained any earlier — at sync, at render — is dead by
 * the time anyone taps anything (INV-NOTES-014). Taking a resolver rather than
 * a string is what makes that structural instead of a convention.
 *
 * Whatever comes back is handed to `decodeAudioData` untouched. The decoder
 * fetches a remote source and decodes a file:// source natively, so this must
 * never assume a local filesystem path (INV-NOTES-012).
 *
 * Lifecycle:
 *   1. play() → decode the URL with `AudioContext.decodeAudioData`, create a
 *      BufferSourceNode, connect to destination, and start.
 *   2. stop() (or audio ends naturally) → close the context and transition
 *      back to `stopped`.
 *   3. A new resolver (different note) stops whatever is running.
 *
 * We avoid direct PCM access — the audio path rule applies only to the live
 * recording hot path, not playback.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { AudioContext } from './audioApi';
import type { AudioBufferSourceNodeLike, AudioContextLike } from './audioApi';

export type PlaybackState = 'stopped' | 'loading' | 'playing' | 'error';

export interface UsePlaybackOptions {
  /**
   * Produce a playable URL. Called when playback starts, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
  /**
   * Start on mount, for a caller whose own control already meant "play"
   * (INT-NOTES-010).
   */
  shouldAutoPlay?: boolean;
}

export interface Playback {
  state: PlaybackState;
  play(): Promise<void>;
  stop(): Promise<void>;
}

export function usePlayback({
  resolveAudioUri,
  shouldAutoPlay = false
}: UsePlaybackOptions): Playback {
  const [state, setState] = useState<PlaybackState>('stopped');
  const ctxRef = useRef<AudioContextLike | null>(null);
  const sourceRef = useRef<AudioBufferSourceNodeLike | null>(null);

  const teardown = useCallback(async (): Promise<void> => {
    try {
      sourceRef.current?.stop();
    } catch {
      // stop() throws if the source has already ended; ignore.
    }
    sourceRef.current = null;
    try {
      await ctxRef.current?.close();
    } catch {
      // ignore
    }
    ctxRef.current = null;
  }, []);

  // Stop any running audio when the source changes (different card opened)
  // and on unmount.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [resolveAudioUri, teardown]);

  const play = useCallback(async (): Promise<void> => {
    if (state === 'loading' || state === 'playing') {
      return;
    }
    setState('loading');
    // Hoisted so the catch can name the URL that actually failed. Logging the
    // cause is what made the original failure diagnosable at all.
    let resolved: string | null = null;
    try {
      // Mint the URL now, not at render: a backend file token is good for
      // about two minutes (INV-NOTES-014).
      resolved = await resolveAudioUri();
      if (!resolved) {
        console.warn('[PlaybackBar] no audio URL could be resolved');
        setState('error');
        return;
      }

      // Hand the URL straight to the decoder. It resolves a remote source by
      // fetching it and a file:// source by decoding natively, which is what
      // INV-NOTES-012 requires: a note served from the backend has an https
      // audio URL, and a note captured but not yet synced has a local one.
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const audioBuffer = await ctx.decodeAudioData(resolved);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setState('stopped');
        sourceRef.current = null;
        void ctx.close().catch(() => undefined);
        ctxRef.current = null;
      };
      source.start(0);
      sourceRef.current = source;
      setState('playing');
    } catch (err) {
      // Swallowing this is what made the original failure undiagnosable: the
      // UI said "Playback failed" and the actual cause never left the closure.
      console.warn('[PlaybackBar] playback failed for', resolved, err);
      setState('error');
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
      sourceRef.current = null;
    }
  }, [resolveAudioUri, state]);

  const stop = useCallback(async (): Promise<void> => {
    await teardown();
    setState('stopped');
  }, [teardown]);

  // Fire once, not on every re-render: play's identity changes with state, so
  // the ref — not the dependency list — is what bounds this.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (!shouldAutoPlay || autoPlayed.current) {
      return;
    }
    autoPlayed.current = true;
    void play();
  }, [shouldAutoPlay, play]);

  return { state, play, stop };
}
