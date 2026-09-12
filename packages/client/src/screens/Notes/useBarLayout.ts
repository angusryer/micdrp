/**
 * The arrangement of bars over a take, and changing it.
 *
 * The bars in force are derived (INV-NOTES-259): proposed from the music,
 * or arranged by hand, as `derive` decided. This only remembers a person's
 * edits between derivations and hands each one on to be kept — every change
 * goes through a pure transform in `logic`, and a kept arrangement comes
 * back through the next derivation as the layout in force.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  addBarLine,
  moveBarLine,
  pickupSteps,
  removeBarLine,
  withPickup,
  type BarLayout
} from 'logic';

export interface BarArrangement {
  layout: BarLayout;
  /** Grid steps the take runs to, which bounds the last bar. */
  totalSteps: number;
  move: (lineIndex: number, toStep: number) => void;
  split: (atStep: number) => void;
  merge: (lineIndex: number) => void;
  /**
   * How long the pickup runs, in steps, and saying how long it should be
   * (INV-NOTES-211).
   *
   * Saying it shifts every line by the same amount, so the bars keep the
   * lengths they had — which `move` cannot do, because it holds a line
   * between its neighbours and resizes the first bar instead.
   */
  pickup: number;
  setPickup: (toSteps: number) => void;
  /** True once a person has arranged the bars themselves. */
  isArranged: boolean;
}

/** What the derivation decided the bars are (INV-NOTES-259). */
export interface DerivedBars {
  layout: BarLayout;
  totalSteps: number;
  isArranged: boolean;
}

export interface BarLayoutOptions {
  /** Called with the new arrangement whenever it changes, for keeping. */
  onArranged?: (lines: number[]) => void;
}

export function useBarLayout(
  derived: DerivedBars,
  options: BarLayoutOptions = {}
): BarArrangement {
  const { onArranged } = options;
  const { layout: restored, totalSteps } = derived;

  const [layout, setLayout] = useState<BarLayout>(restored);
  const [isArranged, setIsArranged] = useState(derived.isArranged);

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
    pickup: pickupSteps(layout),
    setPickup: useCallback(
      (toSteps: number) => applied(withPickup(layout, toSteps, totalSteps)),
      [applied, layout, totalSteps]
    ),
    merge: useCallback(
      (lineIndex) => applied(removeBarLine(layout, lineIndex)),
      [applied, layout]
    )
  };
}
