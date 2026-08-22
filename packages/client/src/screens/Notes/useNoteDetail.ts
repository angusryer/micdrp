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
import { useCallback, useEffect, useMemo, useState } from 'react';

import { notesToMidi, quantize, type NoteEvent } from 'logic';
import type { InterpretationDto } from 'shared';

import {
  chordPitches,
  HEADPHONE_FLOOR_MIDI,
  SPEAKER_FLOOR_MIDI
} from '../../components/chordLayout';
import { cachedNotes } from '../../data/notesSync';
import { notesRepo } from '../../data/notesRepo';
import { writeMidi } from '../../data/files';
import { useBarLayout } from './useBarLayout';
import { useChordTrack } from './useChordTrack';
import { useInterpretation } from './useInterpretation';
import { useNotePlayback } from './useNotePlayback';

/** Stable, so a note with no readings does not look like a new one each render. */
const EMPTY_READINGS: InterpretationDto[] = [];

export function useNoteDetail(id: string) {
  const note = useMemo(() => cachedNotes().find((n) => n.id === id), [id]);
  const melody = (note?.melody ?? []) as NoteEvent[];

  // Mint the audio URL when Play is pressed rather than here: the token it
  // carries is good for about two minutes (INV-NOTES-014).
  const audioPath = note?.audioPath ?? null;
  const resolveAudio = useCallback(
    () => notesRepo.audioUrlFor(id, audioPath),
    [id, audioPath]
  );

  // Fit the metrical grid here rather than reading a stored one. The melody is
  // persisted, so this costs nothing and needs no migration — and it means
  // notes captured before the tempo estimator was fixed are re-read correctly
  // instead of keeping a bpm that was often double what was actually sung.
  const quantized = useMemo(() => quantize(melody), [melody]);
  const grid = quantized.grid;
  const hasGrid = grid.bpm > 0 && melody.length > 1;

  // What this person has already made of the take, kept with the note so a
  // decision outlives the screen it was made on (INV-NOTES-021).
  const interpretation = useInterpretation(
    note?.id ?? null,
    note?.interpretations ?? EMPTY_READINGS
  );

  // Where the bars fall. Detection proposes; a person arranges (INT-NOTES-012).
  const bars = useBarLayout(grid, note?.durationMs ?? 0, {
    savedLines: interpretation.savedBarLines,
    onArranged: interpretation.updateBarLines
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

  const midiUri = useExportedMidi(note?.id ?? null, melody);

  // Where the backdrop sits, which is really a question about what you are
  // listening on. A phone speaker has almost nothing in the low register, so
  // chords voiced where a piano would put them are inaudible on one; lifted
  // towards the melody they can be heard. The same control moves them on the
  // graph, by exactly as much.
  const [chordsLifted, setChordsLifted] = useState(true);
  const floorMidi = chordsLifted ? SPEAKER_FLOOR_MIDI : HEADPHONE_FLOOR_MIDI;
  const chords = useChordTrack(melody, grid, {
    savedEdits: interpretation.savedEdits,
    onEditsChanged: interpretation.update,
    floorMidi
  });
  // Every pitch the chords occupy, so the graph's vertical window takes them
  // in rather than letting them fall off the bottom of it.
  const chordPitchesShown = useMemo(
    () => chordPitches(chords.slots, floorMidi),
    [chords.slots, floorMidi]
  );

  const playback = useNotePlayback(melody, quantized, chords);

  return {
    note,
    melody,
    grid,
    hasGrid,
    gridForView,
    meterIsStated: grid.meterIsStated,
    bars,
    chords,
    chordPitchesShown,
    floorMidi,
    chordsLifted,
    toggleChordsLifted: useCallback(() => setChordsLifted((on) => !on), []),
    resolveAudio,
    midiUri,
    ...playback
  };
}

/** Generate and write the MIDI for export from the stored symbolic melody. */
function useExportedMidi(
  noteId: string | null,
  melody: readonly NoteEvent[]
): string | null {
  const [midiUri, setMidiUri] = useState<string | null>(null);
  useEffect(() => {
    if (!noteId || melody.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const uri = await writeMidi(noteId, notesToMidi(melody as NoteEvent[]));
        if (!cancelled) {
          setMidiUri(uri);
        }
      } catch {
        // Export simply stays unavailable if the write fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId, melody]);
  return midiUri;
}
