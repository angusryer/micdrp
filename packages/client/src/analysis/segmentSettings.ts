/**
 * Every knob that decides what counts as a note, in one table.
 *
 * A table rather than a file per setting, because the list is the thing that
 * has to stay honest: the analysis reads it to know what to use, the settings
 * screen reads it to know what to draw, and a test reads it to insist every
 * entry has a description. A knob added here cannot reach the app without one
 * (INV-ACCOUNT-014).
 *
 * These are read by every caller of segmentNotes through `segmentOptions`.
 * There are three places that segment notes and they must agree about what a
 * note is (INV-PITCH-015).
 */
import { READ_DEFAULTS as D } from 'logic';

import { getJSON, setJSON } from '../data/store';

/** One adjustable, with the range it is meaningful over. */
export interface SegmentKnob {
  /** The `SegmentOptions` field this sets, which is also its storage key. */
  key: string;
  fallback: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  unit?: string;
}

/**
 * The knobs, in the order a person would meet them: what a note is, then what
 * splits one, then what is too small to have been meant.
 */
export const SEGMENT_KNOBS: readonly SegmentKnob[] = [
  // How wide a wobble is still one note. Voices differ more than any default
  // covers — an operatic vibrato is several times a folk singer's.
  { key: 'vibratoSemitones', fallback: D.segment.vibratoSemitones, min: 0.15, max: 1.2, step: 0.05, decimals: 2 },
  // How long a departure must hold before it is a different note rather than
  // the voice passing through.
  { key: 'pitchHoldMs', fallback: D.segment.pitchHoldMs, min: 30, max: 300, step: 10, unit: 'ms' },
  // How long the detector may lose the pitch mid-note without ending it.
  { key: 'maxGapMs', fallback: D.segment.maxGapMs, min: 10, max: 200, step: 10, unit: 'ms' },
  // How far the level must fall during that gap for it to be a stop rather
  // than a flicker — the tongued "da da da" rule (INV-PITCH-023).
  { key: 'articulationDropDb', fallback: D.segment.articulationDropDb, min: 3, max: 40, step: 1, unit: 'dB' },
  // How far the level must climb, fast, for a note to have been pushed again
  // on the breath — the "ha ha ha" rule (INV-PITCH-024).
  { key: 'aspirationRiseDb', fallback: D.segment.aspirationRiseDb, min: 3, max: 30, step: 1, unit: 'dB' },
  // How quickly that climb has to happen to be a re-attack and not a swell.
  { key: 'onsetWindowMs', fallback: D.segment.onsetWindowMs, min: 20, max: 250, step: 10, unit: 'ms' },
  // The shortest thing that can have been sung on purpose.
  { key: 'minDurationMs', fallback: D.segment.minDurationMs, min: 20, max: 200, step: 10, unit: 'ms' }
];

const STORE_PREFIX = 'analysis.segment.';

function clamp(knob: SegmentKnob, value: number): number {
  if (!Number.isFinite(value)) {
    return knob.fallback;
  }
  return Math.min(Math.max(value, knob.min), knob.max);
}

/** What this knob is currently set to. */
export function segmentValue(knob: SegmentKnob): number {
  const stored = getJSON<number>(`${STORE_PREFIX}${knob.key}`);
  return typeof stored === 'number' ? clamp(knob, stored) : knob.fallback;
}

/** Set it. Out-of-range values are brought into range, not refused. */
export function setSegmentValue(knob: SegmentKnob, value: number): number {
  const next = clamp(knob, value);
  setJSON(`${STORE_PREFIX}${knob.key}`, next);
  return next;
}

/** Put every knob back where it started. */
export function resetSegmentValues(): void {
  for (const knob of SEGMENT_KNOBS) {
    setJSON(`${STORE_PREFIX}${knob.key}`, knob.fallback);
  }
}

/** Options every caller of segmentNotes should pass, so they all agree. */
export function segmentOptions(): Record<string, number> {
  const options: Record<string, number> = {};
  for (const knob of SEGMENT_KNOBS) {
    options[knob.key] = segmentValue(knob);
  }
  return options;
}
