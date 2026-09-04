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
  clicksOnBeats,
  metronome,
  playbackTargets,
  transposeTargets,
  type BeatTimeline,
  type NoteEvent,
  type PlaybackMode,
  type quantize
} from 'logic';


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
  hits: readonly { atMs: number; kind: string }[] = [],
  /** The beat in force, so the click strikes where the beats are. */
  timeline: BeatTimeline | null = null
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

  /**
   * The click, on the beats that were actually stated (INV-NOTES-203).
   *
   * A click laid out from a single tempo argues with the person it is
   * playing to: they said where the beats were, and a metronome that
   * ignores that is telling them they were wrong. Falls back to the
   * counted-in click where nobody tapped.
   */
  const clicks = useMemo(() => {
    if (timeline == null || !timeline.isTapped || timeline.beats.length < 2) {
      return counted.clicks;
    }
    // Built where the click's own pitches live, so the tapped click and
    // the counted one sound like the same instrument.
    return clicksOnBeats(timeline.beats, timeline.barStarts);
  }, [timeline, counted.clicks]);
  const countTones = useMemo(
    () =>
      clicks.map((beat) => ({
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
    bus: trackBus('bass'),
    peakGain: BASS_PEAK_GAIN
  });

  // The melody follows the take itself; the chords follow the mix choice.
  // Hanging one off the other made the melody a passenger on a decision about
  // harmony, and it fell silent whenever chords were off (INV-NOTES-027).
  //
  // The bass used to ride the chords for the same kind of reason — a root is
  // part of the harmony it belongs to — and it is a track of its own now for
  // the same kind of reason it stopped being true: a note can carry the bass
  // line as it was actually sung, so this one is a second opinion and is
  // offered rather than imposed (INV-NOTES-135).
  const accompaniment = useMemo(
    () => ({
      start: (offsetMs = 0) => backdrop.start(offsetMs),
      stop: () => backdrop.stop(),
      durationMs: backdrop.durationMs,
      setLevel: (level: number) => backdrop.setLevel(level)
    }),
    [backdrop]
  );

  const bassMix = useMemo(
    () => ({
      start: (offsetMs = 0) => bassVoice.start(offsetMs),
      stop: () => bassVoice.stop(),
      durationMs: bassVoice.durationMs,
      setLevel: (level: number) => bassVoice.setLevel(level)
    }),
    [bassVoice]
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
    /**
     * The metronome's own clicks, for anything that feels them
     * (INV-NOTES-125). Not the tapped beats — those are a statement about
     * where the pulse is, and these are the app ticking it out
     * (INV-NOTES-130).
     */
    clickBeats: clicks,
    rhythmMix,
    playbackMode,
    setPlaybackMode,
    ...octave,
    backdrop: accompaniment,
    /** The root movement read from the take, on its own track (INV-NOTES-135). */
    bassMix,
    melodyVoiceMix,
    ...preview
  };
}
