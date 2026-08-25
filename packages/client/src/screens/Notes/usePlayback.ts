/**
 * Playing a take — through the engine where the engine can, otherwise not.
 *
 * The take is a voice on the one native engine, scheduled on the same clock
 * as everything sounding with it (INV-NOTES-133). A binary built before the
 * engine could hold recorded audio gets the AudioContext player instead:
 * bundles ship over the air to builds older than the native code they assume,
 * and playback there must degrade to what it was rather than to silence
 * (INV-NOTES-030).
 *
 * Chosen once, when this module is first imported, rather than per render. A
 * hook picked per render is a hook order that changes, which React counts —
 * and the answer cannot change while the app is running anyway.
 */
import { useContextTake } from './useContextTake';
import { hasSampleEngine, useTakeVoice } from './useTakeVoice';

export type { Playback, PlaybackState, UsePlaybackOptions } from './playbackShape';

export const usePlayback = hasSampleEngine() ? useTakeVoice : useContextTake;

export default usePlayback;
