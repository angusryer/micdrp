/**
 * Snapping a melody to the beat the singer stated, not to a metronome.
 *
 * Quantising happens in beat space: a note's onset is read as a fractional
 * beat through the timeline, rounded to the nearest subdivision, and read
 * back out as a moment. Where the pulse moved, the snapped moments move
 * with it — which is the point. Snapping a rubato take to a constant tempo
 * does not tidy it, it flattens it, and the further in you go the further
 * out everything lands.
 *
 * Nothing here alters a note. The result is a second reading of the same
 * melody, and which one is shown, played, clicked or exported is a toggle
 * (INV-NOTES-202).
 */
import {
  beatToMs,
  msToBeat,
  type BeatTimeline
} from './beatTimeline';
import type { NoteEvent } from './segmentation';

/** A note as the grid would have it, beside where it actually was. */
export interface SnappedNote extends NoteEvent {
  /** Onset snapped to the timeline, in ms. */
  snappedStartMs: number;
  /** End snapped to the timeline, in ms. Always after the start. */
  snappedEndMs: number;
  /** Where it sits, in fractional beats from the first beat. */
  startBeat: number;
  /** How long it is, in beats, after snapping. */
  durationBeats: number;
  /** Signed ms the singer was early (negative) or late (positive). */
  deviationMs: number;
}

export interface SnapOptions {
  /**
   * Subdivisions of a beat to snap to. 4 means sixteenth notes against a
   * quarter-note beat.
   */
  stepsPerBeat?: number;
  /** The shortest a snapped note may be, in steps. Never zero. */
  minSteps?: number;
}

const DEFAULTS = { stepsPerBeat: 4, minSteps: 1 };

/**
 * Snap a melody onto a timeline.
 *
 * Durations are rounded as durations rather than differenced from two
 * separately rounded ends: rounding both ends independently turns a note
 * that sat a hair either side of a step into one twice or half the length
 * it was sung at.
 */
export function snapToTimeline(
  notes: readonly NoteEvent[],
  timeline: BeatTimeline,
  options: SnapOptions = {}
): SnappedNote[] {
  const stepsPerBeat = options.stepsPerBeat ?? DEFAULTS.stepsPerBeat;
  const minSteps = options.minSteps ?? DEFAULTS.minSteps;
  if (timeline.beats.length < 2 || stepsPerBeat <= 0) {
    return [];
  }

  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
  return sorted.map((note) => {
    const rawStart = msToBeat(timeline, note.startMs);
    const rawEnd = msToBeat(timeline, note.endMs);
    const startStep = Math.round(rawStart * stepsPerBeat);
    const lengthSteps = Math.max(
      minSteps,
      Math.round((rawEnd - rawStart) * stepsPerBeat)
    );

    const startBeat = startStep / stepsPerBeat;
    const endBeat = (startStep + lengthSteps) / stepsPerBeat;
    const snappedStartMs = beatToMs(timeline, startBeat);
    return {
      ...note,
      snappedStartMs,
      snappedEndMs: beatToMs(timeline, endBeat),
      startBeat,
      durationBeats: lengthSteps / stepsPerBeat,
      // How far the singing sat from the beat it was aiming at. Positive is
      // late. Read as "how much was moved", not as a mark out of ten.
      deviationMs: note.startMs - snappedStartMs
    };
  });
}

/**
 * The melody as the grid would have it, in the same shape it came in.
 *
 * For everything that takes a plain melody — the graph, the synth, the
 * exporter — so that turning quantising on is one substitution rather than
 * a different code path per surface (INV-NOTES-202).
 */
export function snappedMelody(
  notes: readonly NoteEvent[],
  timeline: BeatTimeline,
  options: SnapOptions = {}
): NoteEvent[] {
  return snapToTimeline(notes, timeline, options).map((note) => ({
    ...note,
    startMs: note.snappedStartMs,
    endMs: note.snappedEndMs,
    durationMs: note.snappedEndMs - note.snappedStartMs
  }));
}
