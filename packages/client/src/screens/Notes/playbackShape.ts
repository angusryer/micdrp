/**
 * What a take player is.
 *
 * Apart from the player itself so the transport depends on the contract
 * rather than on the machinery: the take is a voice on the native engine
 * (INV-NOTES-133), and nothing above here needs to know that.
 */

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
  /** How long the take runs, once it has been read at least once. */
  durationMs: number;
  stop(): Promise<void>;
}
