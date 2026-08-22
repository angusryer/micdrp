/**
 * useNotePlayback — everything on the note detail screen that makes a sound.
 *
 * Split from useNoteDetail so that file describes the note and this one
 * describes hearing it. They are genuinely separate concerns: the reading of
 * a take does not depend on whether anything is currently sounding.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  playbackTargets,
  type NoteEvent,
  type PlaybackMode,
  type quantize
} from 'logic';

import { createTonePlayer, SynthBus } from '../../audio/synthPlayer';

/** Quieter than the chords: a bass is felt more than it is listened to. */
const BASS_PEAK_GAIN = 0.09;
import { useChordBackdrop } from './useChordBackdrop';
import type { useChordTrack } from './useChordTrack';
import { DEFAULT_MELODY_LEVEL, useMelodyBackdrop } from './useMelodyBackdrop';

/** How long a tapped reference note sounds, in ms. */
const TAP_NOTE_MS = 700;

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

  const melodyTones = useMemo(
    () => playbackTargets(melody, quantized.notes, playbackMode),
    [melody, quantized, playbackMode]
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
      durationMs: Math.max(backdrop.durationMs, bassVoice.durationMs)
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
      durationMs: melodyTones[melodyTones.length - 1]?.endMs ?? 0
    }),
    [melodyVoice, isOverTake, melodyTones]
  );

  // Tap a note to hear its pitch.
  const tonePlayer = useMemo(() => createTonePlayer(SynthBus.Audition), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);

  // Two questions, not one. As sung, a wrong note is the detector's doing; as
  // written, it is what transcription costs (INV-NOTES-026).
  const playMelody = useCallback(() => {
    tonePlayer.stop();
    tonePlayer.play(melodyTones);
  }, [tonePlayer, melodyTones]);

  const playNote = useCallback(
    (midi: number) => tonePlayer.play([{ midi, startMs: 0, endMs: TAP_NOTE_MS }]),
    [tonePlayer]
  );

  // A chord is just its notes sounded together, which the reference player
  // already supports: overlapping targets over the same span.
  const auditionChord = useCallback(
    (index: number) => {
      const midis = chords.voicing(index);
      if (midis.length > 0) {
        tonePlayer.play(
          midis.map((midi) => ({ midi, startMs: 0, endMs: chords.auditionMs }))
        );
      }
    },
    [tonePlayer, chords]
  );

  return {
    playbackMode,
    setPlaybackMode,
    isOverTake,
    setIsOverTake,
    melodyLevel,
    setMelodyLevel,
    backdrop: accompaniment,
    melodyVoiceMix,
    playMelody,
    playNote,
    auditionChord
  };
}
