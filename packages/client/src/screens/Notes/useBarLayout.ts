/**
 * The arrangement of bars over a take, and changing it.
 *
 * Detection proposes an opening arrangement; everything after that is a person
 * moving lines, splitting bars or joining them. Every change goes through a
 * pure transform in `logic`; this only remembers the result and hands it on to
 * be kept.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addBarLine,
  moveBarLine,
  proposeBars,
  removeBarLine,
  type BarLayout,
  type MusicalGrid
} from 'logic';

export interface BarArrangement {
  layout: BarLayout;
  /** Grid steps the take runs to, which bounds the last bar. */
  totalSteps: number;
  move: (lineIndex: number, toStep: number) => void;
  split: (atStep: number) => void;
  merge: (lineIndex: number) => void;
  /** True once a person has arranged the bars themselves. */
  isArranged: boolean;
}

export interface BarLayoutOptions {
  /** An arrangement already kept with the note, if there is one. */
  savedLines?: readonly number[];
  /** Called with the new arrangement whenever it changes, for keeping. */
  onArranged?: (lines: number[]) => void;
  /**
   * Downbeats read from the music, which open a take that nobody has
   * arranged yet. Without them the even division is used, which is a guess
   * about metre rather than a reading of the harmony (INV-NOTES-049).
   */
  proposed?: readonly number[];
}

export function useBarLayout(
  grid: MusicalGrid,
  durationMs: number,
  options: BarLayoutOptions = {}
): BarArrangement {
  const { savedLines, onArranged, proposed: readFromMusic } = options;

  const beatMs = grid.bpm > 0 ? 60000 / grid.bpm : 0;
  const totalSteps = useMemo(() => {
    if (!(beatMs > 0) || !(grid.stepsPerBeat > 0)) {
      return 0;
    }
    const stepMs = beatMs / grid.stepsPerBeat;
    return Math.max(1, Math.ceil((durationMs - grid.offsetMs) / stepMs));
  }, [beatMs, grid.stepsPerBeat, grid.offsetMs, durationMs]);

  const proposed = useMemo<BarLayout>(() => {
    const even = proposeBars(
      grid.beatsPerBar,
      grid.stepsPerBeat,
      grid.isCompound,
      totalSteps
    );
    // What the music says, when it says anything; the even division is the
    // fallback rather than the default.
    return readFromMusic?.length ? { ...even, lines: [...readFromMusic] } : even;
  }, [
    grid.beatsPerBar,
    grid.stepsPerBeat,
    grid.isCompound,
    totalSteps,
    readFromMusic
  ]);

  // A kept arrangement replaces the proposal outright. Unlike a chord, a bar
  // line is not a difference from anything — it is a position, and the
  // positions someone chose are the whole answer.
  const restored = useMemo<BarLayout>(
    () => (savedLines?.length ? { ...proposed, lines: [...savedLines] } : proposed),
    [proposed, savedLines]
  );

  const [layout, setLayout] = useState<BarLayout>(restored);
  const [isArranged, setIsArranged] = useState(Boolean(savedLines?.length));

  // A new proposal means the take itself was re-analysed, at which point the
  // old lines describe a different set of steps.
  useEffect(() => {
    setLayout(restored);
  }, [restored]);

  const applied = useCallback(
    (next: BarLayout) => {
      setLayout(next);
      setIsArranged(true);
      onArranged?.([...next.lines]);
    },
    [onArranged]
  );

  return {
    layout,
    totalSteps,
    isArranged,
    move: useCallback(
      (lineIndex, toStep) => applied(moveBarLine(layout, lineIndex, toStep)),
      [applied, layout]
    ),
    split: useCallback((atStep) => applied(addBarLine(layout, atStep)), [applied, layout]),
    merge: useCallback(
      (lineIndex) => applied(removeBarLine(layout, lineIndex)),
      [applied, layout]
    )
  };
}
