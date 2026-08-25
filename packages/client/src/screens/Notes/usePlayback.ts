/**
 * Playing a take: a voice on the one engine, and nothing else.
 *
 * There was a second way — the take decoded into its own AudioContext, on its
 * own clock — kept for binaries built before the engine could hold recorded
 * audio (INV-NOTES-030). It is gone. Two ways to play the one thing meant two
 * clocks to keep honest and two sets of behaviour to reason about, for the
 * sake of builds nobody runs (INV-NOTES-133).
 *
 * This file is the name the app knows it by; `useTakeVoice` is the thing.
 */
export { useTakeVoice as usePlayback } from './useTakeVoice';
export { useTakeVoice as default } from './useTakeVoice';
export type { Playback, PlaybackState, UsePlaybackOptions } from './playbackShape';
