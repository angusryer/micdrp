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
  proposeDownbeats,
  replayNoteEdits,
  resizeNotes,
  shiftNotes,
  quantize,
  splitOffCount,
  ANALYSIS_VERSION,
  isStale,
  matchedLevels,
  snapNotes,
  sungLoudnessDb,
  addTap,
  beatFromTap,
  markDownbeat,
  moveBeat,
  removeBeat,
  replaceTaps,
  resetBeat,
  readMetre,
  type NoteEdge,
  type NoteEvent
} from 'logic';
import type { HitDto, InterpretationDto } from 'shared';

import {
  chordPitches,
  HEADPHONE_FLOOR_MIDI
} from '../../components/chordLayout';
import { cacheReading, cachedNotes } from '../../data/notesSync';
import { rereadTake } from '../../analysis/reread';
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

export function useNoteDetail(id: string) {
  // Bumped when the take is re-read, so the whole page recomputes from the
  // new reading rather than from the one it opened with (INV-NOTES-116).
  const [readingAt, setReadingAt] = useState(0);
  const note = useMemo(
    () => cachedNotes().find((n) => n.id === id),
    [id, readingAt]
  );
  const heard = (note?.melody ?? []) as NoteEvent[];

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
  //
  // Fitted to the take as heard, not to the take with corrections on top
  // (INV-NOTES-174). A bpm is a pixels-per-millisecond and an offset is a
  // zero, so re-fitting on every edit rescaled and shifted the whole drawing
  // under a change to one note: tapped beats slid, and bar lines — held as
  // step indices — landed at different moments than the beats they were
  // arranged against. The recording is what the reading is fitted to, and the
  // recording does not change when the reading is corrected.
  const quantized = useMemo(() => quantize(heard), [heard]);
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
   * to (INV-NOTES-123). Tapped beats do not appear here at all: they are
   * marks on the recording, not a claim about its metre (INV-NOTES-161).
   */
  const grid = useMemo(() => {
    if (interpretation.savedBpm != null && interpretation.savedBpm > 0) {
      return { ...quantized.grid, bpm: interpretation.savedBpm };
    }
    return quantized.grid;
  }, [quantized.grid, interpretation.savedBpm]);
  const hasGrid = grid.bpm > 0 && melody.length > 1;

  // What was counted, and what was played. The count is a performance and
  // stays on the graph, but it is not music: it states a tempo and implies no
  // harmony, so everything that reads harmony reads the played half
  // (INV-NOTES-113).
  const { counted, played } = useMemo(() => splitOffCount(melody), [melody]);

  // Stable when there are none, so a take with no drums does not look like a
  // different take on every render.
  const hits = useMemo(() => note?.hits ?? EMPTY_HITS, [note]);

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
  const readDownbeats = useMemo(() => {
    // Read from the music, never from the taps. A mark somebody made on
    // their own recording must not redraw the thing it was made on
    // (INV-NOTES-161).
    //
    // From the take as heard, for the same reason the grid is: correcting a
    // note must not move the bar lines out from under the person correcting
    // it (INV-NOTES-174).
    return proposeDownbeats(heard, grid, bass ? { bass } : {});
  }, [heard, grid, bass]);

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
  // How this note is being listened to, kept with the note (INV-NOTES-114).
  /**
   * Where this note's tracks sit before anybody moves them.
   *
   * From how loud the take was actually sung rather than from numbers chosen
   * by ear against one recording: against a quieter take those numbers bury
   * it, and against a loud one they vanish under it (INV-NOTES-141).
   */
  const startLevels = useMemo(
    () =>
      matchedLevels(
        DEFAULT_LEVELS,
        sungLoudnessDb(heard),
        (track) => trackSpec(track).role === 'recording'
      ),
    [heard]
  );
  const listening = useListening(note?.id ?? null, startLevels);
  const { chordOctaves, setChordOctaves } = listening;
  const floorMidi = HEADPHONE_FLOOR_MIDI + 12 * chordOctaves;
  // The chords are the downbeats, seen a second way: each one opens a chord
  // that runs to the next (INV-NOTES-048). Handing the arrangement in is what
  // makes dragging a line move the harmony with it, rather than leaving two
  // structures drawn on one timeline to drift apart.
  const chords = useChordTrack(played, grid, {
    savedEdits: interpretation.savedEdits,
    onEditsChanged: interpretation.update,
    floorMidi,
    downbeatSteps: bars.layout.lines,
    bassLayer: bass,
    isWanted: interpretation.hasHarmony
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
  const reread = useCallback(async () => {
    const uri = note?.audioPath ? await resolveAudio() : null;
    const fresh = await rereadTake(uri);
    if (fresh == null || note == null) {
      return false;
    }
    cacheReading(note.id, fresh);
    await notesRepo.saveReading(note.id, fresh);
    setReadingAt((was) => was + 1);
    return true;
  }, [note, resolveAudio]);

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
      playback.playNote(chosen.midi);
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
        interpretation.updateBeats(
          fresh
            ? replaceTaps(beats, [beatFromTap(atMs)])
            : addTap(beats, atMs)
        );
      },
      [beats, interpretation]
    ),
    /** Said when the take starts sounding: what comes next is a new pass. */
    beginTapPass: useCallback(() => {
      isFreshPass.current = true;
    }, []),
    removeBeatAt: useCallback(
      (index: number) => interpretation.updateBeats(removeBeat(beats, index)),
      [beats, interpretation]
    ),
    clearBeats: useCallback(
      () => interpretation.updateBeats([]),
      [interpretation]
    ),
    moveBeatTo: useCallback(
      (index: number, toMs: number) =>
        interpretation.updateBeats(moveBeat(beats, index, toMs)),
      [beats, interpretation]
    ),
    setBeatIsDownbeat: useCallback(
      (index: number, isDownbeat: boolean) =>
        interpretation.updateBeats(markDownbeat(beats, index, isDownbeat)),
      [beats, interpretation]
    ),
    resetBeatAt: useCallback(
      (index: number) => interpretation.updateBeats(resetBeat(beats, index)),
      [beats, interpretation]
    ),
    /** The tempo in use, and how to set it by hand (INV-NOTES-123). */
    bpm: grid.bpm,
    isBpmByHand: interpretation.savedBpm != null,
    setBpm: interpretation.updateBpm,
    readBpm: quantized.grid.bpm,
    isStale: isStale(note?.analysisVersion),
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

