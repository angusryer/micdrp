/**
 * The rhythm: the beat, bars, tempo and count-in, read from the
 * transcription and corrected by hand (INV-NOTES-255).
 *
 * Exists so notes can be grouped into bars for the harmony and so an
 * overdub comes in on time; it is not a fact about the performance and
 * nothing that produces a note reads it (INV-NOTES-258). Everything here is
 * an inference from the transcription with a person's statements laid over
 * it — and the statements win (INV-NOTES-256).
 *
 * Read from `heard` rather than from the corrected notes, so correcting a
 * note cannot move the bar lines out from under the person correcting it
 * (INV-NOTES-174).
 */
import { drawnBeats, timelineFromAnchors, type DrawnBeat, type AnchoredTimeline, type Anchor } from '../beatAnchors';
import { tappedTempo, type TappedTempo } from '../beatTimeline';
import { proposeBars } from '../barEdits';
import type { BarLayout } from '../bars';
import { proposeDownbeats } from '../downbeats';
import { heldGrid } from '../heldGrid';
import { readMetre, type MetreReading } from '../metre';
import { pickupBeats, pickupStartMs, type Pickup } from '../pickup';
import { quantize, type MusicalGrid, type QuantizedNote, type QuantizeResult } from '../quantize';
import type { NoteEvent } from '../segmentation';
import { tempoFromPattern, type PatternedTempo } from '../tapPattern';
import { anchorsFrom, type VoicedHit } from '../voicedBeats';
import type { RhythmSlice } from './slices';
import type { Transcription } from './transcription';

export interface RhythmInputs {
  durationMs: number;
  /** Percussive sounds in the take, which anchor the beat (INV-NOTES-242). */
  hits: readonly VoicedHit[];
  /** A bass layer sung against the take, which states where chords change. */
  bass?: readonly NoteEvent[];
}

export interface Rhythm {
  /** The grid fitted to what was heard, before any statement. */
  read: MusicalGrid;
  /** The whole fit, for the callers that read how far the notes sat off it. */
  quantizeResult: QuantizeResult;
  /** What the taps say through a tap pattern, or null where nobody set one. */
  patterned: PatternedTempo | null;
  /** The constant grid in use, with tempo and bar length statements on top. */
  grid: MusicalGrid;
  quantized: QuantizedNote[];
  anchors: Anchor[];
  timeline: AnchoredTimeline | null;
  /** The pulse the beat was made at, as a spread (INV-NOTES-201). */
  tapped: TappedTempo | null;
  beatLine: DrawnBeat[];
  /** Downbeats read from the music, which open an unarranged take. */
  proposedDownbeats: number[];
  /** Grid steps the take runs to, which bounds the last bar. */
  totalSteps: number;
  /** The bars as proposed or as arranged, whichever is in force. */
  bars: BarLayout;
  isArranged: boolean;
  metre: MetreReading;
  pickup: Pickup | null;
  pickupStartMs: number;
  pickupBeats: number[];
}

export function deriveRhythm(
  transcription: Transcription,
  slice: RhythmSlice,
  inputs: RhythmInputs
): Rhythm {
  const { heard } = transcription;
  const quantized = quantize(heard);
  const patterned =
    slice.tapPattern == null ? null : tempoFromPattern(slice.beats, slice.tapPattern);
  const grid = heldGrid(quantized.grid, slice.bpm, slice.tapPattern, patterned);

  const anchors = anchorsFrom(slice.beats, inputs.hits, slice.dismissedBeats);
  const timeline = timelineFromAnchors(anchors, quantized.grid.bpm, inputs.durationMs);

  const bass = inputs.bass;
  const proposedDownbeats = proposeDownbeats(heard, grid, bass ? { bass } : {});
  const totalSteps = stepsAcross(grid, inputs.durationMs);
  const bars = barsInForce(grid, totalSteps, proposedDownbeats, slice.barLines);

  return {
    read: quantized.grid,
    quantizeResult: quantized,
    patterned,
    grid,
    quantized: quantized.notes,
    anchors,
    timeline,
    tapped: timeline == null ? null : tappedTempo(timeline),
    beatLine: timeline == null ? [] : drawnBeats(timeline),
    proposedDownbeats,
    totalSteps,
    bars,
    isArranged: Boolean(slice.barLines?.length),
    metre: readMetre(bars.lines, grid),
    pickup: slice.pickup,
    pickupStartMs: pickupStartMs(slice.pickup),
    pickupBeats: pickupBeats(slice.pickup)
  };
}

/** How many grid steps the take spans, which bounds the last bar. */
export function stepsAcross(grid: MusicalGrid, durationMs: number): number {
  const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
  if (!(beatMs > 0) || !(grid.stepsPerBeat > 0)) {
    return 0;
  }
  const stepMs = beatMs / grid.stepsPerBeat;
  return Math.max(1, Math.ceil((durationMs - grid.offsetMs) / stepMs));
}

/**
 * The bars in force: arranged by hand, else read from the music, else an
 * even division (INV-NOTES-049).
 *
 * A kept arrangement replaces the proposal outright. Unlike a chord, a bar
 * line is not a difference from anything — it is a position, and the
 * positions someone chose are the whole answer.
 */
function barsInForce(
  grid: MusicalGrid,
  totalSteps: number,
  fromMusic: readonly number[],
  arranged: readonly number[] | undefined
): BarLayout {
  const even = proposeBars(grid.beatsPerBar, grid.stepsPerBeat, grid.isCompound, totalSteps);
  const proposed = fromMusic.length ? { ...even, lines: [...fromMusic] } : even;
  return arranged?.length ? { ...proposed, lines: [...arranged] } : proposed;
}
