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
  quantize,
  readMetre,
  type NoteEvent
} from 'logic';
import type { InterpretationDto } from 'shared';

import {
  chordPitches,
  HEADPHONE_FLOOR_MIDI,
  SPEAKER_FLOOR_MIDI
} from '../../components/chordLayout';
import { cachedNotes } from '../../data/notesSync';
import { notesRepo } from '../../data/notesRepo';
import { useBarLayout } from './useBarLayout';
import { useChordTrack } from './useChordTrack';
import { useInterpretation } from './useInterpretation';
import { useExportedMidi } from './useExportedMidi';
import type { Selection } from '../../components/graphSelection';
import { useNotePlayback } from './useNotePlayback';

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
  const isCorrected = useCallback(
    (index: number) => heard[index]?.midi !== melody[index]?.midi,
    [heard, melody]
  );

  // Fit the metrical grid here rather than reading a stored one. The melody is
  // persisted, so this costs nothing and needs no migration — and it means
  // notes captured before the tempo estimator was fixed are re-read correctly
  // instead of keeping a bpm that was often double what was actually sung.
  const quantized = useMemo(() => quantize(melody), [melody]);
  const grid = quantized.grid;
  const hasGrid = grid.bpm > 0 && melody.length > 1;

  // Where the harmony turns over, which is what a downbeat marks. The take
  // opens on these rather than on an even division counted out from the
  // tempo (INV-NOTES-049).
  const readDownbeats = useMemo(
    () => proposeDownbeats(melody, grid),
    [melody, grid]
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
            // Only once someone has arranged them: before that the even
            // spacing detection proposed is what should be drawn.
            ...(bars.isArranged ? { barSteps: bars.layout.lines } : {})
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

  const midiUri = useExportedMidi(note?.id ?? null, melody);

  // Where the backdrop sits, which is really a question about what you are
  // listening on. A phone speaker has almost nothing in the low register, so
  // chords voiced where a piano would put them are inaudible on one; lifted
  // towards the melody they can be heard. The same control moves them on the
  // graph, by exactly as much.
  const [chordsLifted, setChordsLifted] = useState(true);
  const floorMidi = chordsLifted ? SPEAKER_FLOOR_MIDI : HEADPHONE_FLOOR_MIDI;
  // The chords are the downbeats, seen a second way: each one opens a chord
  // that runs to the next (INV-NOTES-048). Handing the arrangement in is what
  // makes dragging a line move the harmony with it, rather than leaving two
  // structures drawn on one timeline to drift apart.
  const chords = useChordTrack(melody, grid, {
    savedEdits: interpretation.savedEdits,
    onEditsChanged: interpretation.update,
    floorMidi,
    downbeatSteps: bars.layout.lines
  });
  // Every pitch the chords occupy, so the graph's vertical window takes them
  // in rather than letting them fall off the bottom of it.
  const chordPitchesShown = useMemo(
    () => chordPitches(chords.slots, floorMidi),
    [chords.slots, floorMidi]
  );

  // What is chosen on the graph. Held here so the upright page and the
  // sideways one are looking at the same thing (INT-NOTES-015).
  const [selection, setSelection] = useState<Selection | null>(null);

  const playback = useNotePlayback(melody, quantized, chords);

  return {
    note,
    melody,
    grid,
    hasGrid,
    gridForView,
    metre,
    meterIsStated: grid.meterIsStated,
    bars,
    chords,
    chordPitchesShown,
    floorMidi,
    chordsLifted,
    toggleChordsLifted: useCallback(() => setChordsLifted((on) => !on), []),
    resolveAudio,
    midiUri,
    correctNote,
    resetNote,
    isCorrected,
    selection,
    setSelection,
    ...playback
  };
}

