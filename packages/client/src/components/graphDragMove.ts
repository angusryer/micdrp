/**
 * What a drag does once it has hold of something.
 *
 * Three kinds move in three different units — pitched things by whole
 * semitones, bars by grid steps, beats by raw pixels — and each unit is a
 * claim about what the thing is. Kept out of the gesture so the claims can be
 * read without the machinery around them.
 */
import type { MutableRefObject } from 'react';

import { snapToStep } from '../screens/Notes/barDragAxis';
import { midiToLabel } from '../screens/Results/NoteList';
import {
  MIN_SEMITONE_PX,
  stepAtX,
  type SettledOptions
} from './graphGestureOptions';

/** What the drag remembers between frames, from where the finger went down. */
export interface DragMemory {
  /** How far the drag has already been committed, in that thing's own unit. */
  applied: MutableRefObject<number>;
  /** The pitch of the thing under the finger when it went down. */
  grabbedMidi: MutableRefObject<number | null>;
  /** Where each chosen bar line sat when the finger went down. */
  grabbedBars: MutableRefObject<{ lineIndex: number; x: number }[]>;
}

/** As much of a pan as any of these need. */
export interface DragPoint {
  x: number;
  y: number;
  translationX: number;
  translationY: number;
}

/**
 * Whole semitones only, each emitted once as it is crossed: a note between two
 * pitches is not a note. Everything chosen moves by the same amount, so the
 * shape of a phrase survives being moved as one (INV-NOTES-093).
 */
export function movePitched(
  e: DragPoint,
  o: SettledOptions,
  memory: DragMemory
): void {
  const semitonePx = Math.max(MIN_SEMITONE_PX, o.laneHeight);
  const wanted = Math.round(-e.translationY / semitonePx);
  const step = wanted - memory.applied.current;
  if (step !== 0) {
    memory.applied.current = wanted;
    for (const one of o.selection) {
      if (one.kind === 'chordTone') {
        o.onMoveTone(one.slot, one.tone, step);
      } else if (one.kind === 'melodyNote') {
        o.onMoveNote(one.index, step);
      }
    }
    // Read from where the thing started rather than from where it is now —
    // the same reason the bar drag anchors.
    if (memory.grabbedMidi.current != null) {
      o.onHear?.(memory.grabbedMidi.current + wanted);
    }
  }
  // Only for one thing. With a set in hand there is no single note to name,
  // and a readout claiming one would name the wrong one.
  if (o.selection.length === 1 && memory.grabbedMidi.current != null) {
    o.onPreview?.({
      x: e.x,
      y: e.y,
      midi: memory.grabbedMidi.current + wanted,
      value: midiToLabel(memory.grabbedMidi.current + wanted),
      caption: movedBy(wanted)
    });
  }
}

/** How far it has come, said so a small move reads as a small move. */
function movedBy(semitones: number): string {
  if (semitones === 0) {
    return 'where it was';
  }
  const plural = Math.abs(semitones) === 1 ? '' : 's';
  return `${semitones > 0 ? '+' : ''}${semitones} semitone${plural}`;
}

/**
 * Straight to where the finger is. A tapped beat is what the grid is derived
 * from, so there is no grid to snap it to (INV-NOTES-161).
 */
export function moveBeats(e: DragPoint, o: SettledOptions): void {
  for (const one of o.selection) {
    if (one.kind === 'beat') {
      o.onMoveBeat?.(one.index, e.x);
    }
  }
}

/**
 * Every chosen line moves by the same number of steps, read from where each
 * began rather than from where it now is (INV-NOTES-056).
 */
export function moveBars(
  e: DragPoint,
  o: SettledOptions,
  memory: DragMemory
): void {
  const step = (x: number) => stepAtX(x, o.originX, o.stepWidth);
  const dragged = (memory.grabbedBars.current[0]?.x ?? 0) + e.translationX;
  const moved = step(
    o.snapToGrid ? snapToStep(dragged, o.originX, o.stepWidth) : dragged
  );
  const delta = moved - step(memory.grabbedBars.current[0]?.x ?? 0);
  if (delta === memory.applied.current) {
    return;
  }
  memory.applied.current = delta;
  for (const line of memory.grabbedBars.current) {
    o.onMoveBar(line.lineIndex, step(line.x) + delta);
  }
}
