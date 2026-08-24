/**
 * useNotePlayback — everything on the note detail screen that makes a sound.
 *
 * Split from useNoteDetail so that file describes the note and this one
 * describes hearing it. They are genuinely separate concerns: the reading of
 * a take does not depend on whether anything is currently sounding.
 */
import { trackBus } from './trackRegistry';
import { useMemo, useState } from 'react';

import {
  metronome,
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


/**
 * What register each kind of hit speaks in.
 *
 * A struck sound has no pitch, so these are not its pitch — they are how the
 * synth is asked to stand in for a drum it has no voice for. Low for a thump,
 * high for a hiss, so the kit is legible by ear the way the band is by eye
 * (INV-NOTES-120).
 */
const HIT_PITCH: Record<string, number> = {
  thump: 40,
  tap: 64,
  hiss: 92,
  unknown: 64
};

/** How long a struck sound rings. Short: a hit is a moment. */
const HIT_SOUND_MS = 40;

export function useNotePlayback(
  melody: readonly NoteEvent[],
  quantized: ReturnType<typeof quantize>,
  chords: ReturnType<typeof useChordTrack>,
  /** How long the recording runs, so the click keeps time to the end of it. */
  durationMs = 0,
  /** The struck sounds read out of the take (INV-NOTES-120). */
  hits: readonly { atMs: number; kind: string }[] = []
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

  // The click, as a voice like the others so the mix reaches it. It counts
  // you in from the take's own tempo (INV-NOTES-088) and then keeps going —
  // keeping time through a take is the same job as counting into it, so it is
  // one voice rather than two (INV-NOTES-119).
  const counted = useMemo(
    () =>
      metronome(
        melody[0]?.startMs ?? 0,
        quantized.grid?.bpm ?? 0,
        durationMs,
        quantized.grid?.beatsPerBar ?? 4
      ),
    [melody, quantized.grid?.bpm, quantized.grid?.beatsPerBar, durationMs]
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
  // Its own bus. It shared the melody's until now, so turning the click down
  // turned the tune down with it (INV-NOTES-119).
  const countVoice = useMelodyBackdrop(countTones, trackBus('count'));
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

  // The struck sounds, sounded. A hit has no pitch, so each kind is given a
  // register to speak in: low for a thump, high for a hiss. Standing in for
  // drums with the tone voice the synth has, rather than waiting for a noise
  // voice it does not (INV-NOTES-120).
  const rhythmTones = useMemo(
    () =>
      hits.map((hit) => ({
        midi: HIT_PITCH[hit.kind] ?? HIT_PITCH.unknown,
        startMs: hit.atMs,
        endMs: hit.atMs + HIT_SOUND_MS
      })),
    [hits]
  );
  const rhythmVoice = useMelodyBackdrop(rhythmTones, trackBus('rhythm'));
  const rhythmMix = useMemo(
    () => ({
      start: (offsetMs = 0) => rhythmVoice.start(offsetMs),
      stop: () => rhythmVoice.stop(),
      durationMs: rhythmTones[rhythmTones.length - 1]?.endMs ?? 0,
      setLevel: (level: number) => rhythmVoice.setLevel(level)
    }),
    [rhythmVoice, rhythmTones]
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
    rhythmMix,
    playbackMode,
    setPlaybackMode,
    ...octave,
    backdrop: accompaniment,
    melodyVoiceMix,
    ...preview
  };
}
