/**
 * useNotePlayback — everything on the note detail screen that makes a sound.
 *
 * Split from useNoteDetail so that file describes the note and this one
 * describes hearing it. They are genuinely separate concerns: the reading of
 * a take does not depend on whether anything is currently sounding.
 */
import { useEffect, useMemo, useState } from 'react';

import {
  playbackTargets,
  transposeTargets,
  type NoteEvent,
  type PlaybackMode,
  type quantize
} from 'logic';

import { SynthBus } from '../../audio/synthPlayer';

/** Quieter than the chords: a bass is felt more than it is listened to. */
const BASS_PEAK_GAIN = 0.09;
import { useChordBackdrop } from './useChordBackdrop';
import type { useChordTrack } from './useChordTrack';
import { DEFAULT_MELODY_LEVEL, useMelodyBackdrop } from './useMelodyBackdrop';
import { useOctaveShift } from './useOctaveShift';
import { usePreviewVoice } from './usePreviewVoice';


export function useNotePlayback(
  melody: readonly NoteEvent[],
  quantized: ReturnType<typeof quantize>,
  chords: ReturnType<typeof useChordTrack>
) {
  // Play sounds the backdrop with the take, or on its own, or not at all —
  // whichever the choice beside the play control is set to (INV-NOTES-019).
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('as-sung');
  const [isOverTake, setIsOverTake] = useState(false);
  const [melodyLevel, setMelodyLevel] = useState(DEFAULT_MELODY_LEVEL);
  // A listening aid, not an edit: this moves what sounds and nothing that is
  // drawn, read, or kept (INV-NOTES-058).
  const octave = useOctaveShift(melody);
  const { octaves } = octave;

  const melodyTones = useMemo(
    () =>
      transposeTargets(
        playbackTargets(melody, quantized.notes, playbackMode),
        octaves
      ),
    [melody, quantized, playbackMode, octaves]
  );
  const melodyVoice = useMelodyBackdrop(melodyTones);
  useEffect(() => melodyVoice.setLevel(melodyLevel), [melodyVoice, melodyLevel]);

  const backdrop = useChordBackdrop(chords.progression);
  // The root on its own bus, under the rest of the harmony (INV-NOTES-040).
  // Its own player, so its level can be moved without touching the chords —
  // it is the voice a phone speaker struggles with most.
  const bassVoice = useChordBackdrop(chords.bass, {
    bus: SynthBus.Bass,
    peakGain: BASS_PEAK_GAIN
  });

  // The melody follows the take itself; the chords follow the mix choice.
  // Hanging one off the other made the melody a passenger on a decision about
  // harmony, and it fell silent whenever chords were off (INV-NOTES-027).
  // One transport: the bass starts and stops with the chords it belongs to.
  const accompaniment = useMemo(
    () => ({
      start: (offsetMs = 0) => {
        backdrop.start(offsetMs);
        bassVoice.start(offsetMs);
      },
      stop: () => {
        backdrop.stop();
        bassVoice.stop();
      },
      durationMs: Math.max(backdrop.durationMs, bassVoice.durationMs),
      // The root sits under the harmony above it by a fixed amount, so one
      // control moves the pair and keeps their balance (INV-NOTES-040).
      setLevel: (level: number) => {
        backdrop.setLevel(level);
        bassVoice.setLevel(level);
      }
    }),
    [backdrop, bassVoice]
  );

  const melodyVoiceMix = useMemo(
    () => ({
      start: (offsetMs = 0) => {
        if (isOverTake) {
          melodyVoice.start(offsetMs);
        }
      },
      stop: () => melodyVoice.stop(),
      durationMs: melodyTones[melodyTones.length - 1]?.endMs ?? 0,
      setLevel: (level: number) => melodyVoice.setLevel(level)
    }),
    [melodyVoice, isOverTake, melodyTones]
  );

  const preview = usePreviewVoice(melodyTones, chords, octaves);

  return {
    playbackMode,
    setPlaybackMode,
    isOverTake,
    setIsOverTake,
    melodyLevel,
    setMelodyLevel,
    ...octave,
    backdrop: accompaniment,
    melodyVoiceMix,
    ...preview
  };
}
