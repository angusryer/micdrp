/**
 * What a take player is.
 *
 * Apart from the player itself so the transport depends on the contract
 * rather than on the machinery: the take is a voice on the native engine
 * (INV-NOTES-133), and nothing above here needs to know that.
 */

import type { SharedValue } from 'react-native-reanimated';

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
   * The same moment as `positionMs`, read every frame on the UI thread
   * (INV-NOTES-136). For the drawn playhead, which has to move smoothly; the
   * number above it is read to the second and costs a render.
   */
  drawnPositionMs: SharedValue<number>;
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
  /** How long the take runs, once it has been read at least once. */
  durationMs: number;
  /**
   * Fall silent and leave the head at the moment the take reached, so what
   * is under it stays there to be read (INV-NOTES-152). Resolves with that
   * moment, which is where the next press starts.
   */
  pause(): Promise<number>;
  stop(): Promise<void>;
}
