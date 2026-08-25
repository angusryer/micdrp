/**
 * What a tone player is.
 *
 * A shape rather than a thing: everything that sounds tones does it on a bus
 * of the one native engine (INV-NOTES-028), and this is what the callers of
 * that agreed to. Kept apart from the engine so a call site depends on the
 * contract rather than on the machinery behind it.
 *
 * There used to be a second implementation — one AudioContext per player —
 * carried for binaries built before the engine existed. It is gone, along
 * with the per-context alignment problems that came with it (INV-NOTES-133).
 */
import type { TargetNote } from 'logic';

export interface TonePlayerOptions {
  /** Peak gain for each note, 0..1 (default 0.2 — comfortably below clipping). */
  peakGain?: number;
}

export interface TonePlayer {
  /** Schedule and start playing the melody from the beginning. */
  play(notes: readonly TargetNote[]): void;
  /**
   * Set how loud this player is, 0..1, taking effect immediately.
   *
   * Reaching what is already sounding: mixing a reference against a take is
   * done by ear while listening, not by guessing and starting again
   * (INV-NOTES-027).
   */
  setLevel(level: number): void;
  /** Stop playback. Safe to call repeatedly. */
  stop(): void;
}
