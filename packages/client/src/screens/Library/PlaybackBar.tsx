/**
 * PlaybackBar — play/pause the captured audio for a recording (WP-LIBRARY-UI).
 *
 * Uses react-native-audio-api's `AudioContext` to decode and play the
 * `file://` audio URI stored in a `RecordingMeta`. Playback state is local
 * to this component; it is entirely separate from the live recording path.
 *
 * Lifecycle:
 *   1. User taps Play → fetch the file via RNFS, decode with
 *      `AudioContext.decodeAudioData`, create a BufferSourceNode, connect to
 *      destination, and start.
 *   2. User taps Pause (or audio ends naturally) → close the context and
 *      transition back to `stopped`.
 *   3. A new `audioUri` prop (different recording) resets state.
 *
 * react-native-audio-api provides `AudioContext` for decoding/playback.
 * We avoid direct PCM access — the audio path rule applies only to the live
 * recording hot path, not playback.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-LIBRARY-UI).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import RNFS from 'react-native-fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

interface AudioDestinationNodeLike {}

interface AudioContextLike {
  destination: AudioDestinationNodeLike;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceNodeLike;
  close(): Promise<void>;
}

// ---- Component ----

export type PlaybackState = 'stopped' | 'loading' | 'playing' | 'error';

export interface PlaybackBarProps {
  /** file:// URI of the captured audio to play. */
  audioUri: string;
  /** Optional override duration label (e.g. "1:23"). */
  durationLabel?: string;
}

export function PlaybackBar({ audioUri, durationLabel }: PlaybackBarProps) {
  const { colors } = useTheme();

  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const ctxRef = useRef<AudioContextLike | null>(null);
  const sourceRef = useRef<AudioBufferSourceNodeLike | null>(null);

  // When the audioUri changes (different card opened), stop any running audio.
  useEffect(() => {
    return () => {
      void stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUri]);

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
    try {
      // RNFS.readFile returns a base64 string for the binary audio file.
      const b64 = await RNFS.readFile(
        audioUri.replace(/^file:\/\//, ''),
        'base64'
      );
      // Convert base64 to ArrayBuffer for decodeAudioData.
      const binary = atob(b64);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const audioBuffer = await ctx.decodeAudioData(buffer);
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
    } catch {
      setPlaybackState('error');
      ctxRef.current = null;
      sourceRef.current = null;
    }
  }, [audioUri, playbackState]);

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
