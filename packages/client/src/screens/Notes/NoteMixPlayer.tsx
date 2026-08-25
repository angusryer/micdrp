/**
 * One note, sounding the way that note was left, from anywhere in the app.
 *
 * The list used to play the take alone. It is a recording of a person singing
 * over nothing, and the note plays the chords, the transcription and the drums
 * with it at the levels they were balanced to — so the list was playing a
 * different thing from the one the note plays, using the same file
 * (INV-NOTES-124).
 *
 * Mounted for the note being played and no other. Reading a take costs about
 * a sixth of a second for two minutes of audio, which is affordable once on a
 * press and would not be affordable once per row.
 *
 * It draws nothing. What a press looks like belongs to whatever asked for the
 * sound; this only makes it.
 */
import { useEffect } from 'react';

import { usePlaybackMix } from './usePlaybackMix';
import { useNoteDetail } from './useNoteDetail';
import { withOnlyAvailable } from './playbackTracks';

export interface NoteMixPlayerProps {
  noteId: string;
  /** Told when the sound stops of its own accord, so a caller can catch up. */
  onEnded?: () => void;
  /**
   * How far in the take has got. Reported rather than kept, so the card that
   * asked for the sound can still show a running counter — lifting the player
   * out must not cost the thing the player was showing (INV-NOTES-124).
   */
  onPosition?: (positionMs: number) => void;
}

export function NoteMixPlayer({
  noteId,
  onEnded,
  onPosition
}: NoteMixPlayerProps): null {
  const detail = useNoteDetail(noteId);
  const { listening } = detail;

  // Only what this note actually has. A mix naming a track the note lacks
  // would have the transport waiting on a voice that never sounds.
  const offered = [
    'take' as const,
    ...((detail.backdrop?.durationMs ?? 0) > 0 ? ['chords' as const] : []),
    ...((detail.melodyVoiceMix?.durationMs ?? 0) > 0 ? ['melody' as const] : []),
    ...((detail.rhythmMix?.durationMs ?? 0) > 0 ? ['rhythm' as const] : []),
    ...(detail.layerVoices.durationMs > 0 ? ['layers' as const] : []),
    ...((detail.bassMix?.durationMs ?? 0) > 0 ? ['bass' as const] : []),
    ...((detail.countMix?.durationMs ?? 0) > 0 ? ['count' as const] : [])
  ];

  const { state, positionMs, play, stop } = usePlaybackMix({
    resolveAudioUri: detail.resolveAudio,
    mix: withOnlyAvailable(listening.mix, offered),
    levels: listening.levels,
    accompaniment: detail.backdrop,
    voice: detail.melodyVoiceMix,
    count: detail.countMix,
    rhythm: detail.rhythmMix,
    layers: detail.layerVoices,
    bass: detail.bassMix
  });

  // Plays for as long as it is mounted, and stops when it is not. Unmounting
  // is how a caller says stop, which means there is no way to leave a sound
  // running behind a screen that has gone.
  useEffect(() => {
    void play();
    return () => void stop();
    // Once, on mount: re-running this on every render would restart the take
    // under itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onPosition?.(positionMs), [positionMs, onPosition]);

  useEffect(() => {
    if (state === 'stopped' || state === 'error') {
      onEnded?.();
    }
  }, [state, onEnded]);

  return null;
}

export default NoteMixPlayer;
