/**
 * usePreviewVoice — the one voice the detail view previews with.
 *
 * The melody read from a take, a tapped note, a tapped chord, a pitch crossed
 * by a drag. Four ways of asking the same question, and hearing two answers
 * at once answers neither — so they share a voice, and starting any of them
 * silences whatever it interrupts.
 *
 * All four, through one function. Three of them cleared the melody and two did
 * not, so the control went on offering to stop a melody already cut off, and
 * stopping it did nothing. Anything that takes this voice takes it here
 * (INV-NOTES-190).
 *
 * Split from useNotePlayback, which is about sounding the take itself and was
 * past its line budget.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { transposeMidi, type TargetNote } from 'logic';

import { createTonePlayer, SynthBus } from '../../audio/synthPlayer';
import { useDragAudition } from './useDragAudition';
import type { useChordTrack } from './useChordTrack';

/**
 * How long a note with no length of its own sounds, in ms.
 *
 * Only for a pitch asked about on its own — a chord tone, a row in a list of
 * pitches. A note that knows how long it lasts sounds for that long
 * (INV-NOTES-188).
 */
const TAP_NOTE_MS = 700;

/** Short enough to be a note, so nothing is inaudible however brief it was. */
const LEAST_AUDIBLE_MS = 120;

/** What the voice sits at for anything but a drag, which has its own. */
const PREVIEW_LEVEL = 1;

export function usePreviewVoice(
  melodyTones: readonly TargetNote[],
  chords: ReturnType<typeof useChordTrack>,
  octaves: number
) {
  // Tap a note to hear its pitch.
  const tonePlayer = useMemo(() => createTonePlayer(SynthBus.Audition), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);

  // The control that starts the melody is the control that stops it
  // (INV-NOTES-067). The melody has no callback when it ends, so its own
  // length is the clock: the control must stop offering "stop" at the moment
  // there is nothing left to stop.
  const [isMelodyPlaying, setIsMelodyPlaying] = useState(false);
  const endsAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopMelody = useCallback(() => {
    if (endsAt.current) {
      clearTimeout(endsAt.current);
      endsAt.current = null;
    }
    tonePlayer.stop();
    setIsMelodyPlaying(false);
  }, [tonePlayer]);

  /**
   * Take the voice, at a stated level (INV-NOTES-190).
   *
   * The one act every preview performs. Three of the four cleared the melody
   * and two did not, so the control went on offering to stop a melody already
   * cut off. The level is set every time rather than left as the last caller
   * had it: the drag lowers it for itself, and everything after it played at
   * the drag's level for the rest of the session.
   */
  const claim = useCallback(
    (level: number) => {
      stopMelody();
      tonePlayer.setLevel(level);
    },
    [stopMelody, tonePlayer]
  );

  // Hearing a note as it is moved — its own file, and its own level. It
  // borrows the voice through the same claim as everything else.
  const dragAudition = useDragAudition(
    useMemo(
      () => ({
        play: (targets: readonly TargetNote[]) => tonePlayer.play(targets),
        setLevel: claim
      }),
      [tonePlayer, claim]
    ),
    octaves
  );

  // Two questions, not one. As sung, a wrong note is the detector's doing; as
  // written, it is what transcription costs (INV-NOTES-026).
  const playMelody = useCallback(() => {
    stopMelody();
    if (melodyTones.length === 0) {
      return;
    }
    tonePlayer.play(melodyTones);
    setIsMelodyPlaying(true);
    const runsFor = melodyTones[melodyTones.length - 1]?.endMs ?? 0;
    endsAt.current = setTimeout(() => setIsMelodyPlaying(false), runsFor);
  }, [tonePlayer, melodyTones, stopMelody]);

  // A reading that changes under a sounding melody makes it the wrong
  // melody, and the view going takes the voice with it.
  useEffect(() => stopMelody, [stopMelody, melodyTones]);

  // Shifted like the rest: a tap that checks a pitch has to agree with what
  // playing the melody sounds, or it is checking a different note.
  const playNote = useCallback(
    (midi: number, forMs?: number) => {
      // One voice for all four, so the control never claims to be playing a
      // melody something else has just cut off.
      claim(PREVIEW_LEVEL);
      // Its own length where it has one: a semiquaver and a whole note sounded
      // identical, which hides the thing most often being checked right after
      // a length has been edited (INV-NOTES-188).
      const lasts =
        forMs != null && forMs > 0
          ? Math.max(LEAST_AUDIBLE_MS, forMs)
          : TAP_NOTE_MS;
      tonePlayer.play([
        { midi: transposeMidi(midi, octaves), startMs: 0, endMs: lasts }
      ]);
    },
    [tonePlayer, octaves, claim]
  );

  // A chord is just its notes sounded together, which the reference player
  // already supports: overlapping targets over the same span.
  const auditionChord = useCallback(
    (index: number) => {
      const midis = chords.voicing(index);
      if (midis.length > 0) {
        claim(PREVIEW_LEVEL);
        tonePlayer.play(
          midis.map((midi) => ({ midi, startMs: 0, endMs: chords.auditionMs }))
        );
      }
    },
    [tonePlayer, chords, claim]
  );

  return {
    ...dragAudition,
    playMelody,
    stopMelody,
    isMelodyPlaying,
    playNote,
    auditionChord
  };
}

export default usePreviewVoice;
