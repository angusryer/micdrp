/**
 * useNotePlayback — everything on the note detail screen that makes a sound.
 *
 * Split from useNoteDetail so that file describes the note and this one
 * describes hearing it. They are genuinely separate concerns: the reading of
 * a take does not depend on whether anything is currently sounding.
 */
import { useMemo, useState } from 'react';

import {
  countIn,
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
import { useMelodyBackdrop } from './useMelodyBackdrop';
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

  // The count-in, as a voice like the others so the mix reaches it. Its
  // clicks come from the take's own tempo, counted back from the first note
  // into whatever pickup is actually there (INV-NOTES-088).
  const counted = useMemo(
    () => countIn(melody[0]?.startMs ?? 0, quantized.grid?.bpm ?? 0),
    [melody, quantized.grid?.bpm]
  );
  const countTones = useMemo(
    () =>
      counted.clicks.map((beat) => ({
        midi: beat.midi,
        startMs: beat.startMs,
        endMs: beat.endMs
      })),
    [counted]
  );
  const countVoice = useMelodyBackdrop(countTones);
  const countMix = useMemo(
    () => ({
      start: (offsetMs = 0) => countVoice.start(offsetMs),
      stop: () => countVoice.stop(),
      durationMs: countTones[countTones.length - 1]?.endMs ?? 0,
      // What everything else waits for, so the count finishes before the
      // beat it is counting to arrives (INV-NOTES-088).
      leadInMs: counted.leadInMs,
      setLevel: (level: number) => countVoice.setLevel(level)
    }),
    [countVoice, countTones, counted.leadInMs]
  );

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

  // Started whenever the transport says so. It used to be gated behind a
  // "play over the recording" switch, and when that switch went into the
  // track list the gate stayed — leaving the melody's own toggle turning a
  // track that could never sound (INV-NOTES-083).
  const melodyVoiceMix = useMemo(
    () => ({
      start: (offsetMs = 0) => melodyVoice.start(offsetMs),
      stop: () => melodyVoice.stop(),
      durationMs: melodyTones[melodyTones.length - 1]?.endMs ?? 0,
      setLevel: (level: number) => melodyVoice.setLevel(level)
    }),
    [melodyVoice, melodyTones]
  );

  const preview = usePreviewVoice(melodyTones, chords, octaves);

  return {
    countMix,
    playbackMode,
    setPlaybackMode,
    ...octave,
    backdrop: accompaniment,
    melodyVoiceMix,
    ...preview
  };
}
