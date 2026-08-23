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

/** A level in the path, so the take can be set against the voices over it. */
export interface GainNodeLike {
  gain: { value: number };
  connect(dest: AudioDestinationNodeLike): void;
}

export interface AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null;
  connect(dest: AudioDestinationNodeLike | GainNodeLike): void;
  /** `offset` is where in the buffer to begin, in seconds (INV-NOTES-069). */
  start(when?: number, offset?: number): void;
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
  createGain(): GainNodeLike;
  close(): Promise<void>;
}

export const { AudioContext } = require('react-native-audio-api') as {
  AudioContext: new () => AudioContextLike;
};
