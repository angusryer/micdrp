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
import type { AudioBufferSourceNodeLike, GainNodeLike, AudioContextLike } from './audioApi';
import { usePlaybackClock, useTakeAnchor } from './usePlaybackClock';

export type PlaybackState = 'stopped' | 'loading' | 'playing' | 'error';

export interface UsePlaybackOptions {
  /**
   * Produce a playable URL. Called when playback starts, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
}

export interface Playback {
  state: PlaybackState;
  /**
   * How far into the take playback has run, in ms; 0 in every other state.
   * Unclamped — the view holds the take's length and bounds it against that
   * (INV-NOTES-016).
   */
  positionMs: number;
  /**
   * Milliseconds since the audio started — what a backdrop scheduled against
   * a take already running lines itself up with (INV-NOTES-020).
   */
  elapsedMs: () => number;
  /** Start at a moment in the take. Omitted, from the beginning. */
  play(fromMs?: number): Promise<void>;
  /** How loud the take sits under whatever is playing over it, 0..1. */
  setLevel(level: number): void;
  /** How long the take runs, once it has been decoded at least once. */
  durationMs: number;
  stop(): Promise<void>;
}

export function usePlayback({
  resolveAudioUri
}: UsePlaybackOptions): Playback {
  const [state, setState] = useState<PlaybackState>('stopped');
  // Runs only while audio is running, and resets itself the moment it isn't.
  // Where this run began, so the counter names a moment in the take rather
  // than time-since-press (INV-NOTES-069).
  const [fromMs, setFromMs] = useState(0);
  // Read through refs: the level is set while a take is running, and
  // re-creating the graph to change a number would restart the take.
  const gainRef = useRef<GainNodeLike | null>(null);
  const levelRef = useRef(1);
  const [durationMs, setDurationMs] = useState(0);
  const positionMs = usePlaybackClock(state === 'playing', fromMs);
  const anchor = useTakeAnchor();
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

  const play = useCallback(async (startAtMs = 0): Promise<void> => {
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
      const takeMs = audioBuffer.duration * 1000;
      setDurationMs(takeMs);
      // Brought inside the take: a source started past its own end never
      // fires onended, so the control would sit on "playing" forever.
      const offsetMs = Math.min(Math.max(startAtMs, 0), Math.max(0, takeMs - 1));
      setFromMs(offsetMs);
      // Through a gain rather than straight at the destination: the take is
      // one voice among several now, and a mix needs somewhere to set it.
      const level = ctx.createGain();
      level.gain.value = levelRef.current;
      level.connect(ctx.destination);
      gainRef.current = level;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(level);
      source.onended = () => {
        setState('stopped');
        sourceRef.current = null;
        void ctx.close().catch(() => undefined);
        ctxRef.current = null;
      };
      source.start(0, offsetMs / 1000);
      // The take's clock starts here, not at the press — decode sits between.
      anchor.mark();
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
  }, [anchor, resolveAudioUri, state]);

  const stop = useCallback(async (): Promise<void> => {
    await teardown();
    setState('stopped');
  }, [teardown]);

  const setLevel = useCallback((level: number): void => {
    levelRef.current = Math.max(0, Math.min(1, level));
    if (gainRef.current) {
      gainRef.current.gain.value = levelRef.current;
    }
  }, []);

  return {
    state,
    positionMs,
    elapsedMs: anchor.elapsedMs,
    durationMs,
    play,
    stop,
    setLevel
  };
}
