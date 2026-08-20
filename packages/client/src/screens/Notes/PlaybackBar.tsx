/**
 * PlaybackBar — play/pause a note's captured audio.
 *
 * Uses react-native-audio-api's `AudioContext` to decode and play a note's
 * audio URI. Playback state is local to this component; it is entirely separate
 * from the live recording path.
 *
 * The URL is resolved by the caller at the moment Play is pressed, never
 * before. A note served from the backend needs a token that lives about two
 * minutes, so a URL obtained any earlier — at sync, at render — is dead by the
 * time anyone taps anything (INV-NOTES-014). Taking a resolver rather than a
 * string is what makes that structural instead of a convention.
 *
 * Whatever comes back is handed to `decodeAudioData` untouched. The decoder
 * fetches a remote source and decodes a file:// source natively, so this
 * component must never assume a local filesystem path (INV-NOTES-012).
 *
 * Lifecycle:
 *   1. User taps Play → decode the URL with `AudioContext.decodeAudioData`,
 *      create a BufferSourceNode, connect to destination, and start.
 *   2. User taps Pause (or audio ends naturally) → close the context and
 *      transition back to `stopped`.
 *   3. A new `audioUri` prop (different note) resets state.
 *
 * react-native-audio-api provides `AudioContext` for decoding/playback.
 * We avoid direct PCM access — the audio path rule applies only to the live
 * recording hot path, not playback.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
 
const { AudioContext } = require('react-native-audio-api') as {
  AudioContext: new () => AudioContextLike;
};

import { useTheme } from '../../theme';

// ---- Minimal structural types for the audio-api surface we use ----
// The library has its own .d.ts; we type only the slice we need so the
// component stays mockable under Jest.

interface AudioBufferLike {
  duration: number;
}

interface AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null;
  connect(dest: AudioDestinationNodeLike): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

// Opaque marker — we never read members off the destination node.
type AudioDestinationNodeLike = object;

interface AudioContextLike {
  destination: AudioDestinationNodeLike;
  /** Accepts a remote URL, a file:// URI, or raw bytes. */
  decodeAudioData(source: string | ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceNodeLike;
  close(): Promise<void>;
}

// ---- Component ----

export type PlaybackState = 'stopped' | 'loading' | 'playing' | 'error';

export interface PlaybackBarProps {
  /**
   * Produce a playable URL. Called when Play is pressed, so any token it
   * embeds is fresh. Returning null means the audio could not be resolved.
   */
  resolveAudioUri: () => Promise<string | null>;
  /** Optional override duration label (e.g. "1:23"). */
  durationLabel?: string;
}

export function PlaybackBar({
  resolveAudioUri,
  durationLabel
}: PlaybackBarProps) {
  const { colors } = useTheme();

  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const ctxRef = useRef<AudioContextLike | null>(null);
  const sourceRef = useRef<AudioBufferSourceNodeLike | null>(null);

  // When the source changes (different card opened), stop any running audio.
  useEffect(() => {
    return () => {
      void stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveAudioUri]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      void stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAudio = useCallback(async (): Promise<void> => {
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

  const handlePlay = useCallback(async (): Promise<void> => {
    if (playbackState === 'loading' || playbackState === 'playing') {
      return;
    }
    setPlaybackState('loading');
    // Hoisted so the catch can name the URL that actually failed. Logging the
    // cause is what made the original failure diagnosable at all.
    let resolved: string | null = null;
    try {
      // Mint the URL now, not at render: a backend file token is good for
      // about two minutes (INV-NOTES-014).
      resolved = await resolveAudioUri();
      if (!resolved) {
        console.warn('[PlaybackBar] no audio URL could be resolved');
        setPlaybackState('error');
        return;
      }

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Hand the URL straight to the decoder. It resolves a remote source by
      // fetching it and a file:// source by decoding natively, which is what
      // INV-NOTES-012 requires: a note served from the backend has an https
      // audio URL, and a note captured but not yet synced has a local one.
      const audioBuffer = await ctx.decodeAudioData(resolved);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlaybackState('stopped');
        sourceRef.current = null;
        void ctx.close().catch(() => undefined);
        ctxRef.current = null;
      };
      source.start(0);
      sourceRef.current = source;
      setPlaybackState('playing');
    } catch (err) {
      // Swallowing this is what made the original failure undiagnosable: the
      // UI said "Playback failed" and the actual cause never left the closure.
      console.warn('[PlaybackBar] playback failed for', resolved, err);
      setPlaybackState('error');
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
      sourceRef.current = null;
    }
  }, [resolveAudioUri, playbackState]);

  const handleStop = useCallback(async (): Promise<void> => {
    await stopAudio();
    setPlaybackState('stopped');
  }, [stopAudio]);

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';
  const isError = playbackState === 'error';

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary500}
          accessibilityLabel="Loading audio"
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityState={{ selected: isPlaying }}
          onPress={isPlaying ? handleStop : handlePlay}
          style={[
            styles.button,
            { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
          ]}
        >
          <Text style={[styles.buttonLabel, { color: colors.white }]}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </Pressable>
      )}

      {durationLabel != null ? (
        <Text style={[styles.duration, { color: colors.gray300 }]}>
          {durationLabel}
        </Text>
      ) : null}

      {isError ? (
        <Text style={[styles.error, { color: colors.error }]}>
          Playback failed
        </Text>
      ) : null}
    </View>
  );
}

export default PlaybackBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  duration: {
    fontSize: 13
  },
  error: {
    fontSize: 12
  }
});
