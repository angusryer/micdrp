/**
 * The reading of a take that is currently being edited, and keeping it.
 *
 * Loading and saving live here rather than in useChordTrack so that hook stays
 * about holding a progression: it takes decisions in and reports them out, and
 * has no idea a backend exists.
 *
 * Saves are debounced. An edit fires per gesture and a nudge through six
 * degrees is six of them; writing each one would spend six round trips to
 * describe one decision.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { activeInterpretation, type InterpretationDto } from 'shared';
import type { ChordSlotEdit, NoteEdit, TappedBeat } from 'logic';

import { notesRepo } from '../../data/notesRepo';

/** Long enough to cover a gesture, short enough to survive leaving quickly. */
const SAVE_DELAY_MS = 800;

const NEW_READING = (): InterpretationDto => ({
  id: 'active',
  name: 'Original',
  createdAtMs: 0,
  isFrozen: false,
  chords: []
});

export interface Interpretation {
  /** Decisions already kept, to replay onto fresh inference. */
  savedEdits: readonly ChordSlotEdit[];
  /** An arrangement of bars already kept, if a person has made one. */
  savedBarLines: readonly number[] | undefined;
  /** The tempo a person set, or undefined to use the one read (INV-NOTES-123). */
  savedBpm: number | undefined;
  /** The beat, tapped in against the take (INV-NOTES-130). */
  savedBeats: readonly TappedBeat[];
  /** Whether somebody has asked for the harmony (INV-NOTES-171). */
  hasHarmony: boolean;
  /** Pitches corrected where the detector heard wrongly. */
  savedNoteEdits: readonly NoteEdit[];
  /** Record a new set of differences; written shortly afterwards. */
  update: (edits: ChordSlotEdit[]) => void;
  /** Record a new arrangement of bars; written shortly afterwards. */
  updateBarLines: (lines: number[]) => void;
  /** Set the tempo by hand, or pass undefined to go back to the read one. */
  updateBpm: (bpm: number | undefined) => void;
  /** Replace the tapped beats. */
  updateBeats: (beats: readonly TappedBeat[]) => void;
  /**
   * Ask for the harmony, or ask again once the take has more to go on.
   *
   * Asking again re-reads rather than editing what is there: chord decisions
   * already made replay onto the new reading, because they are decisions
   * about the music rather than about the algorithm (INV-NOTES-171).
   */
  askForHarmony: (analysisVersion: number) => void;
  /** Keep the corrections to what was heard. */
  updateNotes: (notes: NoteEdit[]) => void;
  /** True once a write has failed, so a screen can say so. */
  failed: boolean;
}

export function useInterpretation(
  noteId: string | null,
  stored: readonly InterpretationDto[]
): Interpretation {
  const active = activeInterpretation(stored) ?? NEW_READING();
  const [savedEdits, setSavedEdits] = useState<readonly ChordSlotEdit[]>(
    active.chords as ChordSlotEdit[]
  );
  const [savedNoteEdits, setSavedNoteEdits] = useState<readonly NoteEdit[]>(
    () => active?.notes ?? []
  );
  const [savedBarLines, setSavedBarLines] = useState<readonly number[] | undefined>(
    active.barLines
  );
  const [savedBpm, setSavedBpm] = useState<number | undefined>(active.bpm);
  const [savedBeats, setSavedBeats] = useState<readonly TappedBeat[]>(
    () => active.beats ?? []
  );
  const [hasHarmony, setHasHarmony] = useState(active.harmony != null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frozen = useRef<InterpretationDto[]>([]);
  frozen.current = stored.filter((i) => i.isFrozen);

  // A pending write must not be lost to a screen closing, so it is flushed
  // rather than cancelled. Leaving is the most likely moment for the last
  // edit of a session to happen.
  const flush = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      flush.current?.();
    };
  }, []);

  // Both halves of a reading go through one writer: which chords were chosen
  // and where the bars fall are one answer about one take, and writing them
  // separately would race each other to the same field.
  const latest = useRef<{
    chords: ChordSlotEdit[];
    barLines?: number[];
    notes?: NoteEdit[];
    bpm?: number;
    beats?: TappedBeat[];
    harmony?: { askedAtMs: number; analysisVersion: number };
  }>({
    chords: active.chords as ChordSlotEdit[],
    ...(active.barLines ? { barLines: [...active.barLines] } : {}),
    ...(active.notes ? { notes: [...active.notes] } : {}),
    ...(active.harmony ? { harmony: { ...active.harmony } } : {})
  });

  const schedule = useCallback(
    () => {
      if (noteId == null) {
        return;
      }
      if (timer.current) {
        clearTimeout(timer.current);
      }
      const write = () => {
        timer.current = null;
        flush.current = null;
        // Frozen readings are never touched: their whole purpose is to be
        // unaffected by anything that happens afterwards (INV-NOTES-023).
        void notesRepo
          .saveInterpretations(noteId, [
            ...frozen.current,
            { ...NEW_READING(), ...latest.current }
          ])
          .then(() => setFailed(false))
          .catch(() => setFailed(true));
      };
      flush.current = write;
      timer.current = setTimeout(write, SAVE_DELAY_MS);
    },
    [noteId]
  );

  /**
   * Ask for the harmony, or ask again once the take has more to go on.
   *
   * Stamped with the moment and the engine, so a reading made by an older one
   * can be found and offered again (INV-NOTES-116).
   */
  const askForHarmony = useCallback(
    (analysisVersion: number) => {
      setHasHarmony(true);
      latest.current = {
        ...latest.current,
        harmony: { askedAtMs: Date.now(), analysisVersion }
      };
      schedule();
    },
    [schedule]
  );

  const update = useCallback(
    (edits: ChordSlotEdit[]) => {
      setSavedEdits(edits);
      latest.current = { ...latest.current, chords: edits };
      schedule();
    },
    [schedule]
  );

  const updateNotes = useCallback(
    (notes: NoteEdit[]) => {
      setSavedNoteEdits(notes);
      latest.current = { ...latest.current, notes };
      schedule();
    },
    [schedule]
  );

  const updateBarLines = useCallback(
    (lines: number[]) => {
      setSavedBarLines(lines);
      latest.current = { ...latest.current, barLines: lines };
      schedule();
    },
    [schedule]
  );

  const updateBpm = useCallback(
    (bpm: number | undefined) => {
      setSavedBpm(bpm);
      latest.current = { ...latest.current, bpm };
      schedule();
    },
    [schedule]
  );

  const updateBeats = useCallback(
    (beats: readonly TappedBeat[]) => {
      setSavedBeats(beats);
      latest.current = { ...latest.current, beats: [...beats] };
      schedule();
    },
    [schedule]
  );

  return {
    savedEdits,
    savedBarLines,
    savedBpm,
    savedBeats,
    hasHarmony,
    savedNoteEdits,
    update,
    askForHarmony,
    updateBarLines,
    updateBpm,
    updateBeats,
    updateNotes,
    failed
  };
}
