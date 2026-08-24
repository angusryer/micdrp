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
import { useCallback, useMemo, useState } from 'react';

import {
  collectNoteEdits,
  moveNote,
  proposeDownbeats,
  replayNoteEdits,
  resizeNotes,
  shiftNotes,
  quantize,
  readMetre,
  type NoteEdge,
  type NoteEvent
} from 'logic';
import type { InterpretationDto } from 'shared';

import {
  chordPitches,
  HEADPHONE_FLOOR_MIDI
} from '../../components/chordLayout';
import { cachedNotes } from '../../data/notesSync';
import { notesRepo } from '../../data/notesRepo';
import { useBarLayout } from './useBarLayout';
import { useChordTrack } from './useChordTrack';
import { useInterpretation } from './useInterpretation';
import { useExportedMidi } from './useExportedMidi';
import type { Chosen, Selection } from '../../components/graphSelection';
import { useNoteLayers } from './useNoteLayers';
import { useNotationView } from './useNotationView';
import { useNotePlayback } from './useNotePlayback';

/** How long a thing flashes when its row is pressed, in ms. */
const FLASH_MS = 700;

/** Stable, so a note with no readings does not look like a new one each render. */
const EMPTY_READINGS: InterpretationDto[] = [];

export function useNoteDetail(id: string) {
  const note = useMemo(() => cachedNotes().find((n) => n.id === id), [id]);
  const heard = (note?.melody ?? []) as NoteEvent[];

  // Mint the audio URL when Play is pressed rather than here: the token it
  // carries is good for about two minutes (INV-NOTES-014).
  const audioPath = note?.audioPath ?? null;
  const resolveAudio = useCallback(
    () => notesRepo.audioUrlFor(id, audioPath),
    [id, audioPath]
  );

  // What this person has already made of the take, kept with the note so a
  // decision outlives the screen it was made on (INV-NOTES-021).
  const interpretation = useInterpretation(
    note?.id ?? null,
    note?.interpretations ?? EMPTY_READINGS
  );


  // What the detector heard, with the corrections a person made on top
  // (INV-NOTES-054). Everything downstream reads this rather than the raw
  // hearing, so putting a note right also puts right the harmony read from it.
  const melody = useMemo(
    () => replayNoteEdits(heard, interpretation.savedNoteEdits),
    [heard, interpretation.savedNoteEdits]
  );

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
      interpretation.updateNotes(
        interpretation.savedNoteEdits.filter(
          (edit) => edit.atMs !== original.startMs
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
  const quantized = useMemo(() => quantize(melody), [melody]);
  const grid = quantized.grid;
  const hasGrid = grid.bpm > 0 && melody.length > 1;

  // A second take sung against this one, when there is one. The bass layer
  // is the one that carries harmony: it names the root and states where the
  // chord changes, which are the two things a melody alone only implies
  // (INV-NOTES-071, INV-NOTES-072).
  const { layers, bass, layerCapture, setLayerMuted } = useNoteLayers(
    note?.id ?? null,
    note?.layers
  );

  // Where the harmony turns over, which is what a downbeat marks. The take
  // opens on these rather than on an even division counted out from the
  // tempo (INV-NOTES-049) — unless a layer states it outright.
  const readDownbeats = useMemo(
    () => proposeDownbeats(melody, grid, bass ? { bass } : {}),
    [melody, grid, bass]
  );

  // Where the downbeats fall. Detection proposes; a person arranges
  // (INT-NOTES-012).
  const bars = useBarLayout(grid, note?.durationMs ?? 0, {
    savedLines: interpretation.savedBarLines,
    onArranged: interpretation.updateBarLines,
    proposed: readDownbeats
  });

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
      bars.isArranged,
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
  const [chordOctaves, setChordOctaves] = useState(1);
  const floorMidi = HEADPHONE_FLOOR_MIDI + 12 * chordOctaves;
  // The chords are the downbeats, seen a second way: each one opens a chord
  // that runs to the next (INV-NOTES-048). Handing the arrangement in is what
  // makes dragging a line move the harmony with it, rather than leaving two
  // structures drawn on one timeline to drift apart.
  const chords = useChordTrack(melody, grid, {
    savedEdits: interpretation.savedEdits,
    onEditsChanged: interpretation.update,
    floorMidi,
    downbeatSteps: bars.layout.lines,
    bassLayer: bass
  });
  // Every pitch the chords occupy, so the graph's vertical window takes them
  // in rather than letting them fall off the bottom of it.
  const chordPitchesShown = useMemo(
    () => chordPitches(chords.slots, floorMidi),
    [chords.slots, floorMidi]
  );

  // What is chosen on the graph. Held here so the upright page and the
  // sideways one are looking at the same thing (INT-NOTES-015).
  const [selection, setSelection] = useState<Chosen>([]);
  // Made to flash from its row in the sheet, so several things that read the
  // same in a list can be told apart on the graph (INV-NOTES-094).
  const [flashing, setFlashing] = useState<Selection | null>(null);
  const flash = useCallback((one: Selection) => {
    setFlashing(one);
    setTimeout(() => setFlashing(null), FLASH_MS);
  }, []);

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
      interpretation.updateNotes(
        collectNoteEdits(
          heard,
          resizeNotes(melody, chosen, (steps * beatMs) / perBeat, edge)
        )
      );
    },
    [selection, grid.bpm, grid.stepsPerBeat, melody, heard, interpretation]
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
      interpretation.updateNotes(
        collectNoteEdits(
          heard,
          shiftNotes(melody, chosen, (steps * beatMs) / perBeat)
        )
      );
    },
    [selection, grid.bpm, grid.stepsPerBeat, melody, heard, interpretation]
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

  const playback = useNotePlayback(melody, quantized, chords);

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
    floorMidi,
    chordOctaves,
    setChordOctaves,
    resolveAudio,
    midiUri,
    correctNote,
    resetNote,
    resizeChosen,
    shiftChosen,
    nudgeChosen,
    resetLengths,
    hasResized,
    isCorrected,
    layers,
    bass,
    setLayerMuted,
    layerCapture,
    selection,
    setSelection,
    flashing,
    flash,
    ...playback
  };
}

