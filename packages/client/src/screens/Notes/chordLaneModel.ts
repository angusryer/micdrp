/**
 * Where each chord sits along the take, worked out without a screen.
 *
 * The lane is drawn under the melody it was read from (INV-NOTES-029), so it
 * borrows the melody's own time axis rather than measuring the take again: a
 * second axis would drift from the line above it and put a chord under notes
 * nobody sang it against.
 */
import type { ChordSlot } from 'logic';

import type { MelodyLayout } from '../../components/melodyLayout';

/** The melody layout's time axis — the only thing the lane needs from it. */
export type LaneAxis = MelodyLayout['timeAxis'];

/** One chord as a band of the lane, at a pixel position. */
export interface ChordBand {
  /** Index into the track's slots, so a band names the card that edits it. */
  index: number;
  x: number;
  width: number;
  label: string;
  /** True once a person has chosen this chord, so the lane can say so. */
  isEdited: boolean;
}

/** Narrowest band worth drawing, in px. Below this a label cannot be read. */
const MIN_BAND_WIDTH = 2;

/**
 * Lay the progression out across the melody's time axis.
 *
 * A chord that runs off either end is clipped rather than dropped: the grid
 * starts at the first bar line, which is often before the first note and
 * usually after the last one, so the outer chords of almost every take overhang
 * the melody they belong to. Clipping keeps them visible under the notes they
 * do cover; dropping them would leave the ends of the lane bare.
 */
export function layoutChordLane(
  slots: readonly ChordSlot[],
  axis: LaneAxis
): ChordBand[] {
  if (!(axis.span > 0) || !(axis.innerW > 0)) {
    return [];
  }
  const t1 = axis.t0 + axis.span;
  const xAt = (ms: number) =>
    axis.pad + ((ms - axis.t0) / axis.span) * axis.innerW;

  const bands: ChordBand[] = [];
  slots.forEach((slot, index) => {
    const startMs = Math.max(slot.startMs, axis.t0);
    const endMs = Math.min(slot.endMs, t1);
    if (endMs <= startMs) {
      return;
    }
    const x = xAt(startMs);
    const width = xAt(endMs) - x;
    if (width < MIN_BAND_WIDTH) {
      return;
    }
    bands.push({ index, x, width, label: slot.label, isEdited: slot.isEdited });
  });
  return bands;
}
