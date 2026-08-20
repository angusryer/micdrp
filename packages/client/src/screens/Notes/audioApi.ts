/**
 * The slice of react-native-audio-api's playback surface we actually use.
 *
 * The library ships its own .d.ts; typing only this slice structurally is what
 * keeps the playback path mockable under Jest, where the whole module is
 * replaced by a fake AudioContext.
 */

export interface AudioBufferLike {
  duration: number;
}

export interface AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null;
  connect(dest: AudioDestinationNodeLike): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

/** Opaque marker — we never read members off the destination node. */
export type AudioDestinationNodeLike = object;

export interface AudioContextLike {
  destination: AudioDestinationNodeLike;
  /** Accepts a remote URL, a file:// URI, or raw bytes. */
  decodeAudioData(source: string | ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceNodeLike;
  close(): Promise<void>;
}

export const { AudioContext } = require('react-native-audio-api') as {
  AudioContext: new () => AudioContextLike;
};
