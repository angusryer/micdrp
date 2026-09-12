/**
 * useNoteDetail — everything a note's detail view knows, in one place.
 *
 * Split from the screen so the screen is composition and this is state. It
 * also means the same note can be presented two ways — upright, and the
 * graph-first landscape layout — without either presentation owning the
 * wiring.
 *
 * Nothing here re-touches the audio: the symbolic melody is read from the
 * cache and everything else is derived from it (INV-NOTES-003).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  collectNoteEdits,
  moveNote,
  resizeNotes,
  shiftNotes,
  ANALYSIS_VERSION,
  isStale,
  matchedLevels,
  peakLoudnessDb,
  takeGain,
  snapNotes,
  sungLoudnessDb,
  addTap,
  beatFromTap,
  markDownbeat,
  moveBeat,
  replaceTaps,
  resetBeat,
  readMetre,
  countedBars,
  countedMetre,
  anchorOf,
  insideTake,
  movePickup,
  pickupFrom,
  withPickupBeats,
  writeAt,
  unwrite,
  removeAnchor,
  noteAt,
  deriveHarmony,
  deriveRhythm,
  deriveTranscription,
  harmonySlice,
  rhythmSlice,
  transcriptionSlice,
  type NoteEdge,
  type NoteEvent,
  type Statements
} from 'logic';
import type { HitDto, InterpretationDto } from 'shared';

import {
  chordPitches,
  HEADPHONE_FLOOR_MIDI
} from '../../components/chordLayout';
import { cachedNotes } from '../../data/notesSync';
import { rereadChange, rereadNote } from '../../analysis/rereadNote';
import { beatLengthAt } from './beatLengthAt';
import {
  restoreReadWith,
  seedReadWith
} from '../../analysis/takeKnobs';
import {
  forgetKeptReading,
  keptReading
} from '../../analysis/keptReading';
import { notesRepo } from '../../data/notesRepo';
import { useBarLayout } from './useBarLayout';
import { useChordTrack } from './useChordTrack';
import { useListening } from './useListening';
import { useInterpretation } from './useInterpretation';
import { useExportedMidi } from './useExportedMidi';
import type { Chosen, Selection } from '../../components/graphSelection';
import { DEFAULT_LEVELS } from './playbackTracks';
import { offeredTracks } from './offeredTracks';
import { trackSpec } from './trackRegistry';
import { useLayerVoices } from './useLayerVoices';
import { useNoteLayers } from './useNoteLayers';
import { useNotationView } from './useNotationView';
import { useNotePlayback } from './useNotePlayback';
import { useRetimed } from './useRetimed';

/** How long a thing flashes when its row is pressed, in ms. */
const FLASH_MS = 700;

/** Stable, so a note with no readings does not look like a new one each render. */
const EMPTY_READINGS: InterpretationDto[] = [];

/** Likewise for a take with nothing struck in it. */
const EMPTY_HITS: HitDto[] = [];

/** Stable, so a take with nothing heard is the same take on every render. */
const EMPTY_PITCHES: number[] = [];

/**
 * And for a note whose take has not been read yet (INV-NOTES-234).
 *
 * This one was written as a literal at the point of use, which made it a
 * different array every render and invalidated eleven memos below it every
 * time — for the note just captured and the note whose reading failed, which
 * are the two least able to afford it.
 */
const EMPTY_MELODY: NoteEvent[] = [];

export function useNoteDetail(id: string) {
  // Bumped when the take is re-read, so the whole page recomputes from the
  // new reading rather than from the one it opened with (INV-NOTES-116).
  const [readingAt, setReadingAt] = useState(0);
  /**
   * Whether there is a reading to put back (INV-NOTES-215).
   *
   * Seeded from what is kept on the device, so the way back survives
   * closing the note rather than lasting only as long as the screen.
   */
  const [canUndoReread, setCanUndoReread] = useState(false);
  const note = useMemo(
    () => cachedNotes().find((n) => n.id === id),
    // readingAt is the whole point and cannot be seen from the body:
    // cachedNotes() is impure, and this is the bump that says to read it
    // again after a re-read (INV-NOTES-116). Removing it would leave the page
    // showing the reading it opened with for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, readingAt]
  );
  /**
   * What was heard, with what was written in merged into it
   * (INV-NOTES-246).
   *
   * Merged here rather than handled apart, because everything downstream is
   * written against one list of notes. An edit is anchored by the moment it
   * covers rather than by an index (INV-NOTES-096), so a written note in
   * this list can be corrected, moved, resized, quantised and exported like
   * any other with nothing else changed at all (INV-NOTES-247).
   */
  const sung = useMemo(() => note?.melody ?? EMPTY_MELODY, [note]);

  // Mint the audio URL when Play is pressed rather than here: the token it
  // carries is good for about two minutes (INV-NOTES-014).
  //
  // The copy on this device wins where there is one. It is the faster thing
  // to read, it needs no token, and for a take that has not been uploaded yet
  // it is the only copy there is (INV-NOTES-139).
  const audioPath = note?.audioPath ?? null;
  const localAudioUri = note?.localAudioUri ?? null;
  const resolveAudio = useCallback(
    () =>
      localAudioUri != null
        ? Promise.resolve(localAudioUri)
        : notesRepo.audioUrlFor(id, audioPath),
    [id, audioPath, localAudioUri]
  );

  // What this person has already made of the take, kept with the note so a
  // decision outlives the screen it was made on (INV-NOTES-021).
  const interpretation = useInterpretation(
    note?.id ?? null,
    note?.interpretations ?? EMPTY_READINGS
  );

  /**
   * Everything a person has said about the take, in the shape the
   * derivation reads (INV-NOTES-260). One object, so each layer's
   * derivation can take the slice it is allowed to see and no more.
   */
  const statements = useMemo<Statements>(
    () => ({
      notes: interpretation.savedNoteEdits,
      writtenNotes: interpretation.savedWrittenNotes,
      deletedNotes: interpretation.savedDeletedNotes,
      beats: interpretation.savedBeats,
      dismissedBeats: interpretation.savedDismissedBeats,
      barLines: interpretation.savedBarLines,
      bpm: interpretation.savedBpm,
      tapPattern: interpretation.savedTapPattern,
      pickup: interpretation.savedPickup,
      chords: interpretation.savedEdits,
      harmony: interpretation.hasHarmony ? { askedAtMs: 0, analysisVersion: 0 } : null
    }),
    [
      interpretation.savedNoteEdits,
      interpretation.savedWrittenNotes,
      interpretation.savedDeletedNotes,
      interpretation.savedBeats,
      interpretation.savedDismissedBeats,
      interpretation.savedBarLines,
      interpretation.savedBpm,
      interpretation.savedTapPattern,
      interpretation.savedPickup,
      interpretation.savedEdits,
      interpretation.hasHarmony
    ]
  );

  // A second take sung against this one, when there is one. The bass layer
  // is the one that carries harmony: it names the root and states where the
  // chord changes, which are the two things a melody alone only implies
  // (INV-NOTES-071, INV-NOTES-072). Read before anything is derived,
  // because the rhythm and the harmony both take it as an input.
  const { layers, bass, layerCapture, setLayerMuted } = useNoteLayers(
    note?.id ?? null,
    note?.layers
  );
  const hits = useMemo(() => note?.hits ?? EMPTY_HITS, [note]);

  /**
   * The layers of the take, derived by the same pure functions the corpus
   * tool runs with no screen (INV-NOTES-259). Three calls rather than one,
   * because the chord floor the harmony is voiced at depends on how the
   * take is being listened to, and that is only known once the levels have
   * been read from the transcription.
   */
  const transcription = useMemo(
    () => deriveTranscription(sung, transcriptionSlice(statements)),
    [sung, statements]
  );
  const { heard } = transcription;


  // What the detector heard, with the corrections a person made on top
  // (INV-NOTES-054). Everything downstream reads this rather than the raw
  // hearing, so putting a note right also puts right the harmony read from it.
  const melody = transcription.notes;

  const correctNote = useCallback(
    (index: number, semitones: number) => {
      const corrected = moveNote(melody, index, semitones);
      interpretation.updateNotes(collectNoteEdits(heard, corrected));
    },
    [heard, melody, interpretation]
  );

  /** Put one note back to the pitch the detector actually heard. */
  const resetNote = useCallback(
    (index: number) => {
      const original = heard[index];
      if (!original) {
        return;
      }
      // The edit whose anchor this note owns, found with the same slack
      // replay uses — an edit anchored before a re-read moved the note is
      // still this note's edit (INV-NOTES-096).
      interpretation.updateNotes(
        interpretation.savedNoteEdits.filter(
          (edit) => noteAt(heard, edit.atMs) !== index
        )
      );
    },
    [heard, interpretation]
  );

  /** True where this note is not the pitch that was heard. */
  /**
   * True where this note is not what was heard — in pitch or in length.
   *
   * Both, because "put it back" undoes the whole edit: one edit carries
   * everything about a note, so offering it only for a changed pitch would
   * hide the way to undo a changed length (INV-NOTES-098).
   */
  const isCorrected = useCallback(
    (index: number) => {
      const was = heard[index];
      const now = melody[index];
      if (!was || !now) {
        return false;
      }
      return (
        was.midi !== now.midi ||
        was.startMs !== now.startMs ||
        was.endMs !== now.endMs
      );
    },
    [heard, melody]
  );

  /** Whether any note has been made longer or shorter than it was heard. */
  const hasResized = useMemo(
    () =>
      interpretation.savedNoteEdits.some(
        (edit) => edit.startMs != null || edit.endMs != null
      ),
    [interpretation.savedNoteEdits]
  );

  /**
   * Put every length back, keeping every pitch correction.
   *
   * Two undos rather than one: correcting a wrong note and shaping its length
   * are different pieces of work, and throwing away both because you wanted
   * one back would cost more than it saved (INV-NOTES-098).
   */
  const resetLengths = useCallback(() => {
    interpretation.updateNotes(
      interpretation.savedNoteEdits
        .filter((edit) => edit.midi != null)
        .map((edit) => ({ atMs: edit.atMs, midi: edit.midi }))
    );
  }, [interpretation]);

  // Fit the metrical grid here rather than reading a stored one. The melody is
  // persisted, so this costs nothing and needs no migration — and it means
  // notes captured before the tempo estimator was fixed are re-read correctly
  // instead of keeping a bpm that was often double what was actually sung.
  //
  // Fitted to the take as heard, not to the take with corrections on top
  // (INV-NOTES-174). A bpm is a pixels-per-millisecond and an offset is a
  // zero, so re-fitting on every edit rescaled and shifted the whole drawing
  // under a change to one note: tapped beats slid, and bar lines — held as
  // step indices — landed at different moments than the beats they were
  // arranged against. The recording is what the reading is fitted to, and the
  // recording does not change when the reading is corrected.
  const rhythm = useMemo(
    () =>
      deriveRhythm(transcription, rhythmSlice(statements), {
        durationMs: note?.durationMs ?? 0,
        hits,
        bass
      }),
    [transcription, statements, note?.durationMs, hits, bass]
  );
  // The reading's own fit, kept under the name the rest of this hook has
  // always read it by.
  const quantized = rhythm.quantizeResult;
  // A tempo set by hand stands in front of the one read from the take. The
  // reading is left as it was — this is a decision about the take rather than
  // a correction to what was heard, and it has to survive a re-read
  // (INV-NOTES-123).
  // The beat somebody tapped along with the take. It outranks every reading
  // of the same thing, because there is nothing to detect in it
  // (INV-NOTES-130).
  // The tapping is sparse on purpose, so the grid is fitted to it rather than
  // Marks, and nothing more. A grid used to be fitted to them and drove
  // everything downstream, so four taps changed the tempo, which moved the
  // bar lines, which re-cut the harmony of a take somebody was in the middle
  // of reading. Every step defensible, the whole a surprise (INV-NOTES-161).
  const beats = interpretation.savedBeats;
  // Whether the next tap opens a pass. A ref rather than state: nothing is
  // drawn from it, and re-rendering the graph on a press would cost the very
  // timing the tapping exists to state.
  const isFreshPass = useRef(false);
  /**
   * The grid in use.
   *
   * A tempo set by hand stands in front of whatever was read from the take;
   * the reading is left as it was, so the estimate is always there to go back
   * to (INV-NOTES-123).
   *
   * Tapped beats still say nothing on their own (INV-NOTES-161). They speak
   * only through a pattern somebody set — which beats of the bar they were
   * meant for — and a take carries none until then, so this is the grid it
   * had (INV-NOTES-209). Unsaying it brings that grid back, because nothing
   * was overwritten to get here.
   *
   * Three answers, most recent claim first: a tempo typed by hand, then the
   * taps read through a pattern, then the reading. A hand-set tempo outranks
   * a pattern because it says the one thing directly rather than by
   * implication.
   */
  const patterned = rhythm.patterned;
  const grid = rhythm.grid;
  const hasGrid = grid.bpm > 0 && melody.length > 1;

  /**
   * The beat the taps anchor, and the pulse they were made at.
   *
   * The taps are where they were tapped and are never moved
   * (INV-NOTES-198); the beats between two of them come from the reading,
   * warped to meet both (INV-NOTES-236). Filling those gaps is what makes
   * the pulse below readable at all — one missed tap used to halve the
   * slowest figure and report a spread nobody played.
   *
   * Still not inference acting on its own: the tempo is offered by the
   * tempo row and applied only when pressed (INV-NOTES-161).
   */

  /**
   * Every beat a person put there, by finger or by mouth (INV-NOTES-242).
   *
   * A thump or a consonant in the take says what a tap says, so both anchor
   * the timeline — and one thrown away stays thrown away, which is what the
   * dismissals are for (INV-NOTES-243).
   */
  const { anchors, timeline, tapped } = rhythm;

  // What was counted, and what was played. The count is a performance and
  // stays on the graph, but it is not music: it states a tempo and implies no
  // harmony, so everything that reads harmony reads the played half
  // (INV-NOTES-113).
  // The tune itself is read by the harmony's derivation; only the count is
  // still wanted here, to draw it as the ground the tune sits on.
  const { counted } = transcription;

  // Stable when there are none, so a take with no drums does not look like a
  // different take on every render.
  // A second take sung against this one, when there is one. The bass layer
  // is the one that carries harmony: it names the root and states where the
  // chord changes, which are the two things a melody alone only implies
  // (INV-NOTES-071, INV-NOTES-072).

  // Where the harmony turns over, which is what a downbeat marks. The take
  // opens on these rather than on an even division counted out from the
  // tempo (INV-NOTES-049) — unless a layer states it outright.
  // Where the downbeats fall. Detection proposes; a person arranges
  // (INT-NOTES-012).
  const bars = useBarLayout(
    { layout: rhythm.bars, totalSteps: rhythm.totalSteps, isArranged: rhythm.isArranged },
    { onArranged: interpretation.updateBarLines }
  );

  const gridForView = useMemo(
    () =>
      hasGrid
        ? {
            bpm: grid.bpm,
            offsetMs: grid.offsetMs,
            beatsPerBar: grid.beatsPerBar,
            stepsPerBeat: grid.stepsPerBeat,
            // Always the arrangement's own lines, arranged by hand or read
            // from the music. Drawing an even division while the downbeats
            // sat elsewhere put the picture and the thing you can pick up in
            // two different places (INV-NOTES-104).
            barSteps: bars.layout.lines
          }
        : undefined,
    [
      hasGrid,
      grid.bpm,
      grid.offsetMs,
      grid.beatsPerBar,
      grid.stepsPerBeat,
      // Not bars.isArranged: nothing here reads it, and the lines it would
      // change are already listed.
      bars.layout.lines
    ]
  );

  // Read back from where the downbeats ended up, rather than constraining
  // them. Nothing in the editing surface consumes it — it is for what gets
  // written out, and it wants a person's last word before it does
  // (INV-NOTES-050).
  const metre = useMemo(
    () => readMetre(bars.layout.lines, grid),
    [bars.layout.lines, grid]
  );

  // Two readings of one take, for the eye. A snap onto the wrong step is
  // plain in the picture and all but inaudible in a short take, which is how
  // the quantizer gets judged (INV-NOTES-026). Only the drawing follows this:
  // the chords, the bars and the edits are all read from the melody itself.
  const notation = useNotationView(melody, quantized.notes, hasGrid);

  const midiUri = useExportedMidi(note?.id ?? null, melody);

  // Where the backdrop sits, which is really a question about what you are
  // listening on. A phone speaker has almost nothing in the low register, so
  // chords voiced where a piano would put them are inaudible on one; lifted
  // towards the melody they can be heard. The same control moves them on the
  // graph, by exactly as much.
  // Said as what it is. "Lift for the speaker" was a listening choice that
  // only ever moved the chords by an octave, and every other line already
  // says that in octaves (INV-NOTES-039).
  // How this note is being listened to, kept with the note (INV-NOTES-114).
  /**
   * Where this note's tracks sit before anybody moves them.
   *
   * From how loud the take was actually sung rather than from numbers chosen
   * by ear against one recording: against a quieter take those numbers bury
   * it, and against a loud one they vanish under it (INV-NOTES-141).
   */
  const sungDb = useMemo(() => sungLoudnessDb(heard), [heard]);
  /** The loudest note, so the lift never drives it into the ceiling. */
  const peakDb = useMemo(() => peakLoudnessDb(heard), [heard]);
  const startLevels = useMemo(
    () =>
      matchedLevels(
        DEFAULT_LEVELS,
        sungDb,
        (track) => trackSpec(track).role === 'recording',
        peakDb
      ),
    [sungDb, peakDb]
  );
  /**
   * How much the take itself is lifted to sit with the tracks read from it
   * (INV-NOTES-141).
   *
   * A recording at a level of one is already as loud as it was sung, so
   * without this the match could only push the tracks down — and against a
   * take quieter than its floor it ran out of room and left them above the
   * singing.
   */
  const takeMakeUp = useMemo(() => takeGain(sungDb, peakDb), [sungDb, peakDb]);
  const listening = useListening(note?.id ?? null, startLevels);
  const { chordOctaves, setChordOctaves } = listening;
  const floorMidi = HEADPHONE_FLOOR_MIDI + 12 * chordOctaves;
  // The chords are the downbeats, seen a second way: each one opens a chord
  // that runs to the next (INV-NOTES-048). Handing the arrangement in is what
  // makes dragging a line move the harmony with it, rather than leaving two
  // structures drawn on one timeline to drift apart.
  const harmony = useMemo(
    () =>
      deriveHarmony(transcription, rhythm, harmonySlice(statements), {
        bass,
        floorMidi
      }),
    [transcription, rhythm, statements, bass, floorMidi]
  );
  const chords = useChordTrack(harmony, {
    onEditsChanged: interpretation.update,
    floorMidi
  });
  // Every pitch the chords occupy, so the graph's vertical window takes them
  // in rather than letting them fall off the bottom of it.
  const chordPitchesShown = useMemo(
    () => chordPitches(chords.slots, floorMidi),
    [chords.slots, floorMidi]
  );

  /**
   * The highest and lowest the take was heard at, kept in the window.
   *
   * The window is fitted to the notes drawn, so correcting the top note
   * downwards closed it in and moved every other note on the graph. Declaring
   * what was heard means the window never shrinks below the take, however the
   * reading of it is edited (INV-NOTES-174). It still opens outwards for an
   * edit that goes past what was heard, since a note has to stay visible.
   */
  const heardPitches = useMemo(() => {
    if (heard.length === 0) {
      return EMPTY_PITCHES;
    }
    const all = heard.map((n) => n.midi);
    return [Math.min(...all), Math.max(...all)];
  }, [heard]);

  // What is chosen on the graph. Held here so the upright page and the
  // sideways one are looking at the same thing (INT-NOTES-015).
  const [selection, setSelection] = useState<Chosen>([]);
  // The span of the last edit that changed when something happens, and the
  // way to say one did (INV-NOTES-178).
  const { retimed, markRetimed } = useRetimed();

  // Made to flash from its row in the sheet, so several things that read the
  // same in a list can be told apart on the graph (INV-NOTES-094).
  const [flashing, setFlashing] = useState<Selection | null>(null);
  const flash = useCallback((one: Selection) => {
    setFlashing(one);
    setTimeout(() => setFlashing(null), FLASH_MS);
  }, []);

  /**
   * Where an edit ends up: on the grid, or exactly where it was put.
   *
   * Applied to the edited notes and to no others — quantising the whole take
   * because one note moved is an edit nobody asked for (INV-NOTES-143).
   */
  const settle = useCallback(
    (notes: NoteEvent[], chosen: readonly number[]): NoteEvent[] => {
      const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
      const perBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
      return listening.snapToGrid && beatMs > 0
        ? snapNotes(notes, chosen, beatMs / perBeat, grid.offsetMs)
        : notes;
    },
    [listening.snapToGrid, grid.bpm, grid.stepsPerBeat, grid.offsetMs]
  );

  /**
   * Change how long the chosen notes last, a sixteenth at a time.
   *
   * The finest thing worth nudging by: a whole beat is a bigger step than
   * most corrections need, and anything smaller is below what a sung note
   * distinguishes. Everything else stays where it is; a note lengthened into
   * its neighbour joins with it (INV-NOTES-095).
   */
  const resizeChosen = useCallback(
    (steps: number, edge: NoteEdge = 'end') => {
      const chosen = selection.flatMap((one) =>
        one.kind === 'melodyNote' ? [one.index] : []
      );
      const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
      const perBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
      if (chosen.length === 0 || !(beatMs > 0) || steps === 0) {
        return;
      }
      markRetimed(chosen, melody);
      interpretation.updateNotes(
        collectNoteEdits(
          heard,
          settle(
            resizeNotes(melody, chosen, (steps * beatMs) / perBeat, edge),
            chosen
          )
        )
      );
    },
    [
      selection,
      grid.bpm,
      grid.stepsPerBeat,
      melody,
      heard,
      interpretation,
      markRetimed,
      settle
    ]
  );

  /** Move the chosen notes in time, a sixteenth a step (INV-NOTES-111). */
  const shiftChosen = useCallback(
    (steps: number) => {
      const chosen = selection.flatMap((one) =>
        one.kind === 'melodyNote' ? [one.index] : []
      );
      const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
      const perBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
      if (chosen.length === 0 || !(beatMs > 0) || steps === 0) {
        return;
      }
      markRetimed(chosen, melody);
      interpretation.updateNotes(
        collectNoteEdits(
          heard,
          settle(shiftNotes(melody, chosen, (steps * beatMs) / perBeat), chosen)
        )
      );
    },
    [
      selection,
      grid.bpm,
      grid.stepsPerBeat,
      melody,
      heard,
      interpretation,
      markRetimed,
      settle
    ]
  );

  /** Move the chosen notes by whole semitones, from the sheet. */
  const nudgeChosen = useCallback(
    (semitones: number) => {
      for (const one of selection) {
        if (one.kind === 'melodyNote') {
          correctNote(one.index, semitones);
        } else if (one.kind === 'chordTone') {
          chords.moveTone(one.slot, one.tone, semitones);
        }
      }
    },
    [selection, correctNote, chords]
  );

  /**
   * Read this take again with whatever the engine can do now.
   *
   * Only the derived parts are replaced. The interpretation is left alone —
   * edits are anchored to the moment the detector first heard them and replay
   * against whatever is read now, and an edit whose note is gone simply finds
   * nothing, which is what the warning says (INV-NOTES-116).
   */
  /**
   * Put the previous reading back (INV-NOTES-215).
   *
   * Null where there is nothing to put back, which is every take that has
   * not been read again on this device.
   */
  const undoReread = useCallback(async () => {
    if (note == null) {
      return;
    }
    const kept = keptReading(note.id);
    if (kept == null) {
      return;
    }
    await notesRepo.saveReading(note.id, {
      melody: kept.melody as never,
      hits: kept.hits as never,
      analysisVersion: kept.analysisVersion,
      readWith: kept.readWith
    });
    // The settings go back with it, or the take is stamped with numbers
    // that did not produce what it now holds (INV-NOTES-216).
    if (kept.readWith != null) {
      restoreReadWith(note.id, kept.readWith);
    }
    forgetKeptReading(note.id);
    setCanUndoReread(false);
    setReadingAt((was) => was + 1);
  }, [note]);

  // The way back survives closing the note, so whether there is one is read
  // rather than remembered only for as long as the screen lives.
  useEffect(() => {
    setCanUndoReread(note?.id != null && keptReading(note.id) != null);
  }, [note?.id, readingAt]);

  // Take the settings the note arrived carrying, where this device has none
  // — which is every take after a reinstall, and a reinstall is exactly when
  // a library gets read again (INV-NOTES-216). Never overwrites: what is on
  // the device is the working copy.
  useEffect(() => {
    if (note?.id != null && note.readWith != null) {
      seedReadWith(note.id, note.readWith);
    }
  }, [note?.id, note?.readWith]);

  const reread = useCallback(async () => {
    if (note == null) {
      return null;
    }
    // One path with the list of notes (INV-NOTES-262): the audio, the
    // thresholds, the kept reading and what is written back are all the
    // same act wherever it is asked for.
    const why = await rereadNote(note);
    if (why != null) {
      return why;
    }
    setCanUndoReread(true);
    setReadingAt((was) => was + 1);
    return null;
  }, [note]);

  // The layers as performances rather than as readings of them
  // (INV-NOTES-134). Loaded when the note opens, so a press is a schedule.
  const layerVoices = useLayerVoices(
    note?.id ?? null,
    layers,
    note?.durationMs ?? 0
  );

  const playback = useNotePlayback(
    melody,
    quantized,
    chords,
    note?.durationMs ?? 0,
    hits
  );

  /**
   * Choosing a note sounds it (INV-NOTES-175).
   *
   * "Hear it" sat in the sheet as a control, so checking a note cost two
   * presses — one to choose it and one to hear it — when the pitch is the
   * reason it was touched. Only for one note: a set has no single pitch to
   * name, and sounding all of them answers a question nobody asked.
   */
  const sounded = useRef<number | null>(null);
  useEffect(() => {
    const one = selection.length === 1 ? selection[0] : null;
    const index = one?.kind === 'melodyNote' ? one.index : null;
    if (index == null) {
      sounded.current = null;
      return;
    }
    // Held, so the note does not sound again every time anything else on the
    // page recomputes.
    if (sounded.current === index) {
      return;
    }
    sounded.current = index;
    const chosen = melody[index];
    if (chosen) {
      playback.playNote(chosen.midi, chosen.endMs - chosen.startMs);
    }
  }, [selection, melody, playback]);

  /**
   * Nudging a pitch sounds the pitch it becomes (INV-NOTES-176).
   *
   * Through the drag's own audition rather than the tap's, so it obeys the
   * same switch and sits at the same level: it is the same edit, and only the
   * control making it differs.
   */
  const nudgeChosenAloud = useCallback(
    (semitones: number) => {
      nudgeChosen(semitones);
      const one = selection.length === 1 ? selection[0] : null;
      if (one?.kind !== 'melodyNote') {
        return;
      }
      const moved = melody[one.index];
      if (moved) {
        playback.hearDragged(moved.midi + semitones);
      }
    },
    [nudgeChosen, selection, melody, playback]
  );

  return {
    note,
    melody,
    grid,
    hasGrid,
    gridForView,
    metre,
    meterIsStated: grid.meterIsStated,
    /** The melody as the chosen reading draws it — the graph's notes. */
    shownMelody: notation.notes,
    notationView: notation.view,
    setNotationView: notation.setView,
    canNotate: notation.canNotate,
    bars,
    chords,
    chordPitchesShown,
    heardPitches,
    floorMidi,
    chordOctaves,
    listening,
    takeMakeUp,
    sungDb,
    setChordOctaves,
    resolveAudio,
    midiUri,
    correctNote,
    resetNote,
    countedNotes: counted.length,
    /** The struck sounds in this take (INV-PITCH-025). */
    hits,
    /** True where this take would read differently if it were read again. */
    /** The beat tapped along with the take (INV-NOTES-130). */
    beats,
    /**
     * Whether the harmony has been asked for, and how to ask (INV-NOTES-171).
     *
     * Asking again re-reads with whatever the take has been given since —
     * beats tapped, bars marked, a bass line sung — and the chord decisions
     * already made replay onto the new reading.
     */
    hasHarmony: interpretation.hasHarmony,
    /**
     * Ask for the chords, take them off the graph, ask afresh
     * (INV-NOTES-231). One control, in that order.
     */
    toggleHarmony: useCallback(() => {
      if (interpretation.hasHarmony) {
        interpretation.forgetHarmony();
      } else {
        interpretation.askForHarmony(ANALYSIS_VERSION);
      }
    }, [interpretation]),
    askForHarmony: useCallback(
      () => interpretation.askForHarmony(ANALYSIS_VERSION),
      [interpretation]
    ),

    /**
     * Tap the beat. The first tap of a pass throws away the pass before it.
     *
     * Tapping the take through a second time is a correction, not an
     * addition: keeping both readings would give a grid twice as dense as
     * either, fitted to a pulse nobody played (INV-NOTES-131).
     */
    tapBeat: useCallback(
      (atMs: number) => {
        const fresh = isFreshPass.current;
        isFreshPass.current = false;
        // Inside the take. A beat in the count-in would be a pulse stated
        // where nothing was sung (INV-NOTES-253).
        const at = insideTake(atMs);
        interpretation.updateBeats(
          fresh
            ? replaceTaps(beats, [beatFromTap(at)])
            : addTap(beats, at)
        );
      },
      [beats, interpretation]
    ),
    /** Said when the take starts sounding: what comes next is a new pass. */
    beginTapPass: useCallback(() => {
      isFreshPass.current = true;
    }, []),
    /**
     * Throw a beat off the graph, whichever kind it is (INV-NOTES-243).
     *
     * Indexed into the anchors rather than the taps, because the anchors
     * are what the graph draws and touches. A tap is deleted; a voiced beat
     * is written down as gone, since the audio still holds the sound and
     * the next read would find it again.
     */
    removeBeatAt: useCallback(
      (index: number) => {
        const after = removeAnchor(
          anchors,
          index,
          beats,
          interpretation.savedDismissedBeats
        );
        if (after.taps.length !== beats.length) {
          interpretation.updateBeats(after.taps);
        }
        if (
          after.dismissed.length !== interpretation.savedDismissedBeats.length
        ) {
          interpretation.updateDismissedBeats(after.dismissed);
        }
      },
      [anchors, beats, interpretation]
    ),
    clearBeats: useCallback(
      () => interpretation.updateBeats([]),
      [interpretation]
    ),
    /**
     * Move a beat to where it should have been (INV-NOTES-163).
     *
     * Moving a beat heard in the take turns it into a tapped one: the sound
     * is still in the audio where it always was, so the moved beat is a
     * person saying where the pulse actually is rather than a correction to
     * the recording. The sound it came from is written off, or the next
     * read would put a second beat back beside the moved one
     * (INV-NOTES-243).
     */
    moveBeatTo: useCallback(
      (index: number, toMs: number) => {
        const going = anchors[index];
        if (going == null) {
          return;
        }
        // Held inside the take, however far the finger travelled into the
        // count-in in front of it (INV-NOTES-253).
        const to = insideTake(toMs);
        if (going.isVoiced !== true) {
          const at = beats.findIndex((tap) => tap.atMs === going.atMs);
          if (at >= 0) {
            interpretation.updateBeats(moveBeat(beats, at, to));
          }
          return;
        }
        interpretation.updateBeats(addTap(beats, to));
        interpretation.updateDismissedBeats([
          ...interpretation.savedDismissedBeats,
          going.atMs
        ]);
      },
      [anchors, beats, interpretation]
    ),
    /**
     * Mark a beat as the start of a bar, whichever kind it is.
     *
     * A voiced beat becomes a tapped one first: a bar mark is a statement
     * about the music that has to survive a re-read, and there is nowhere
     * on a sound in the audio to keep one.
     */
    setBeatIsDownbeat: useCallback(
      (index: number, isDownbeat: boolean) => {
        const one = anchors[index];
        if (one == null) {
          return;
        }
        if (one.isVoiced === true) {
          const grown = addTap(beats, one.atMs);
          const at = grown.findIndex((tap) => tap.atMs === one.atMs);
          interpretation.updateBeats(markDownbeat(grown, at, isDownbeat));
          interpretation.updateDismissedBeats([
            ...interpretation.savedDismissedBeats,
            one.atMs
          ]);
          return;
        }
        const at = beats.findIndex((tap) => tap.atMs === one.atMs);
        if (at >= 0) {
          interpretation.updateBeats(markDownbeat(beats, at, isDownbeat));
        }
      },
      [anchors, beats, interpretation]
    ),
    /** Put a moved beat back where the finger landed. Taps only: a voiced
     * beat has never been anywhere but where the sound is. */
    resetBeatAt: useCallback(
      (index: number) => {
        const one = anchors[index];
        const at =
          one == null
            ? -1
            : beats.findIndex((tap) => tap.atMs === one.atMs);
        if (at >= 0) {
          interpretation.updateBeats(resetBeat(beats, at));
        }
      },
      [anchors, beats, interpretation]
    ),
    /**
     * Write a note in at the playhead (INV-NOTES-245).
     *
     * A quarter of the beat the playhead is actually in, read off the beat
     * timeline rather than off a constant tempo, so it is a quarter beat in
     * a take that breathes too.
     */
    addNoteAt: useCallback(
      (atMs: number, midi: number) => {
        // Held inside the take: the count-in in front of it is empty by
        // construction, and a note there would claim something was sung
        // where nothing was performed at all (INV-NOTES-253).
        const at = insideTake(atMs);
        interpretation.updateWrittenNotes([
          ...interpretation.savedWrittenNotes,
          writeAt(at, midi, beatLengthAt(timeline, grid.bpm, at))
        ]);
      },
      [interpretation, timeline, grid.bpm]
    ),
    /**
     * Throw a note off the graph, sung or written (INV-NOTES-248).
     *
     * A written note goes from the list it lives in — there is nowhere
     * else it exists. A sung one is recorded as thrown away, because the
     * audio still holds it and the next read would find it again.
     *
     * Anchored against what was heard rather than against the corrected
     * note, so a note that was moved is still found by its own deletion
     * (INV-NOTES-096).
     */
    deleteNoteAt: useCallback(
      (index: number) => {
        const going = heard[index];
        if (going == null) {
          return;
        }
        if (going.isWritten === true) {
          interpretation.updateWrittenNotes(
            unwrite(interpretation.savedWrittenNotes, going.startMs)
          );
          return;
        }
        interpretation.updateDeletedNotes([
          ...interpretation.savedDeletedNotes,
          anchorOf(going)
        ]);
      },
      [heard, interpretation]
    ),
    /**
     * The count-in put in front of the take, or null where nobody has made
     * one (INV-NOTES-250). Nothing reads one out of a recording.
     */
    pickup: interpretation.savedPickup,
    /** Where the drawing has to begin to show it (INV-NOTES-252). */
    pickupStartMs: rhythm.pickupStartMs,
    /** The moments the count's beats fall on, all before the take. */
    pickupBeats: rhythm.pickupBeats,
    /**
     * Make a count-in from a pass of taps (INV-NOTES-251).
     *
     * The pulse is the steadiest run of them, not the whole pass — and a
     * pass with nothing steady in it makes nothing rather than a guess.
     * It spaces the count's beats and is never applied to the take.
     */
    makePickup: useCallback(
      (taps: readonly number[], beats: number) =>
        interpretation.updatePickup(pickupFrom(taps, beats)),
      [interpretation]
    ),
    /** Say how long the count runs, keeping the pulse it was tapped at. */
    setPickupBeats: useCallback(
      (beats: number) =>
        interpretation.updatePickup(
          interpretation.savedPickup == null
            ? null
            : withPickupBeats(interpretation.savedPickup, beats)
        ),
      [interpretation]
    ),
    /** Move the whole count — the one way it can reach the take. */
    movePickupTo: useCallback(
      (endMs: number) =>
        interpretation.updatePickup(
          interpretation.savedPickup == null
            ? null
            : movePickup(interpretation.savedPickup, endMs)
        ),
      [interpretation]
    ),
    /** Take the count away. */
    clearPickup: useCallback(
      () => interpretation.updatePickup(null),
      [interpretation]
    ),
    /** How many sung notes have been thrown away (INV-NOTES-249). */
    deletedNoteCount: interpretation.savedDeletedNotes.length,
    /**
     * Put every thrown-away note back, corrections and all.
     *
     * A deletion only hides the note: the edit that corrected it is still
     * anchored to a moment that does not move, so restoring finds it
     * again (INV-NOTES-249).
     */
    restoreDeletedNotes: useCallback(
      () => interpretation.updateDeletedNotes([]),
      [interpretation]
    ),
    writtenNotes: interpretation.savedWrittenNotes,
    /** The tempo in use, and how to set it by hand (INV-NOTES-123). */
    bpm: grid.bpm,
    isBpmByHand: interpretation.savedBpm != null,
    /** Whether the previous reading can be put back (INV-NOTES-215). */
    canUndoReread,
    undoReread,
    /** What the taps were said to be for, or undefined if nobody has said. */
    tapPattern: interpretation.savedTapPattern,
    setTapPattern: interpretation.updateTapPattern,
    /** What the taps say through that pattern, or null where they say nothing. */
    patternedTempo: patterned,
    /** How many taps there are to read a pattern through. */
    tapCount: interpretation.savedBeats.length,
    /**
     * What the tapped beats imply, or null. Offered by the tempo row and
     * applied only when pressed — the taps stay marks until then
     * (INV-NOTES-161, INV-NOTES-196).
     */
    tappedBpm: tapped?.medianBpm ?? null,
    /**
     * The slowest and fastest the pulse ran, where it moved. One number
     * for a take that breathes is a claim nobody made (INV-NOTES-201).
     */
    tappedRange:
      tapped == null
        ? null
        : ([tapped.slowestBpm, tapped.fastestBpm] as const),
    /**
     * Every beat of the take, tapped and worked out together, each saying
     * which it is (INV-NOTES-237). The taps stay in `beats`: a derived
     * beat is not something to drag, it is something to replace by
     * tapping one (INV-NOTES-238).
     */
    beatLine: rhythm.beatLine,
    /**
     * The beats a finger can reach: what a person put there, not the fills.
     *
     * A derived beat is not a thing to drag or throw away — it is a thing
     * to replace by tapping one (INV-NOTES-238).
     */
    anchors,
    /** Gaps the fill had to guess the length of (INV-NOTES-200). */
    suspectGaps: timeline?.suspectGaps ?? [],
    /** The bars counted between marked downbeats (INV-NOTES-199). */
    countedBars: timeline == null ? [] : countedBars(timeline),
    /** The metre those counts imply, or null where the bars disagree. */
    countedMetre: timeline == null ? null : countedMetre(timeline),
    setBpm: interpretation.updateBpm,
    readBpm: quantized.grid.bpm,
    isStale: isStale(note?.analysisVersion),
    /** Which of three things a re-read would do (INV-NOTES-262). */
    rereadChange: note == null ? ('unchanged' as const) : rereadChange(note),
    reread,
    resizeChosen,
    shiftChosen,
    nudgeChosen: nudgeChosenAloud,
    /** The span of the last edit that changed when something happens. */
    retimed,
    resetLengths,
    hasResized,
    isCorrected,
    layers,
    bass,
    setLayerMuted,
    layerCapture,
    /** The layers as they were sung, for the transport (INV-NOTES-134). */
    layerVoices,
    selection,
    setSelection,
    flashing,
    flash,
    ...playback,
    /**
     * Which tracks this note actually has, for the rail beside the graph and
     * the options list alike — one answer to one question (INT-NOTES-026).
     */
    railTracks: offeredTracks({
      chords: playback.backdrop?.durationMs,
      bass: playback.bassMix?.durationMs,
      melody: playback.melodyVoiceMix?.durationMs,
      rhythm: playback.rhythmMix?.durationMs,
      count: playback.countMix?.durationMs,
      layers: layerVoices.durationMs
    })
  };
}

