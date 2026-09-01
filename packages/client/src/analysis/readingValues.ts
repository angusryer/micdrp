/**
 * What each knob is currently set to, and the reading assembled from them
 * (INV-NOTES-172).
 *
 * Split from the table so that file is the list of what exists and this is
 * where the values live — the two change for different reasons, and a table
 * entry is read far more often than a storage rule.
 */
import { READ_DEFAULTS } from 'logic';

import { getJSON, setJSON } from '../data/store';

import {
  DECLARED_KNOBS as READING_KNOBS,
  type KnobGroup,
  type ReadingKnob
} from './readingKnobs';

/**
 * Where a knob's value lives.
 *
 * Grouped in the key, so two knobs of the same name in different parts of the
 * reading cannot collide — `minClarity` means one thing to the smoother and
 * would mean another to anything else.
 */
const keyFor = (knob: ReadingKnob) => `analysis.${knob.group}.${knob.key}`;

const clamp = (knob: ReadingKnob, value: number): number =>
  Number.isFinite(value)
    ? Math.min(Math.max(value, knob.min), knob.max)
    : knob.fallback;

/** What this knob is currently set to. */
export function knobValue(knob: ReadingKnob): number {
  // The segmentation knobs kept their old home, so a mix somebody already
  // tuned is not silently reset by the move into this table.
  const legacy =
    knob.group === 'segment'
      ? getJSON<number>(`analysis.segment.${knob.key}`)
      : undefined;
  const stored = getJSON<number>(keyFor(knob)) ?? legacy;
  return typeof stored === 'number' ? clamp(knob, stored) : knob.fallback;
}

/** Set it. Out-of-range values are brought into range, not refused. */
export function setKnobValue(knob: ReadingKnob, value: number): number {
  const next = clamp(knob, value);
  setJSON(keyFor(knob), next);
  if (knob.group === 'segment') {
    setJSON(`analysis.segment.${knob.key}`, next);
  }
  return next;
}

/** Put every knob back where it started. */
export function resetKnobs(): void {
  for (const knob of READING_KNOBS) {
    setKnobValue(knob, knob.fallback);
  }
}

/**
 * The whole reading, assembled from the table.
 *
 * Built here rather than written out again, so adding a knob is one entry and
 * not two — a second list would drift the moment either was edited.
 */
export function readingOptions(): {
  smooth: Record<string, number>;
  segment: Record<string, number>;
  bends: Record<string, number>;
  percussion: Record<string, number>;
  minArticulationMs: number;
} {
  const of = (group: KnobGroup): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const knob of READING_KNOBS.filter((k) => k.group === group)) {
      out[knob.key] = knobValue(knob);
    }
    return out;
  };
  const top = READING_KNOBS.find((k) => k.key === 'minArticulationMs');
  return {
    smooth: of('smooth'),
    segment: of('segment'),
    bends: of('bends'),
    percussion: of('percussion'),
    minArticulationMs: top ? knobValue(top) : READ_DEFAULTS.minArticulationMs
  };
}
