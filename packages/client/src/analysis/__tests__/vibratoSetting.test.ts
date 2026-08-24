/**
 * The vibrato width as a thing a person sets — INV-PITCH-015.
 *
 * Three places segment notes and they must agree about what a note is, so the
 * value lives in one place and is read rather than passed around.
 */
import {
  DEFAULT_VIBRATO_SEMITONES,
  MAX_VIBRATO_SEMITONES,
  MIN_VIBRATO_SEMITONES,
  segmentOptions,
  setVibratoSemitones,
  vibratoSemitones
} from '../vibratoSetting';
import { SEGMENT_KNOBS } from '../segmentSettings';

import { remove } from '../../data/store';

beforeEach(() => remove('analysis.vibratoSemitones'));

describe('vibratoSemitones', () => {
  it('has a default before anyone has chosen', () => {
    expect(vibratoSemitones()).toBe(DEFAULT_VIBRATO_SEMITONES);
  });

  it('remembers what was chosen', () => {
    setVibratoSemitones(0.9);
    expect(vibratoSemitones()).toBeCloseTo(0.9);
  });

  it('brings an out-of-range value into range rather than refusing it', () => {
    // A stepper held down should stop at the end, not stop working.
    expect(setVibratoSemitones(99)).toBe(MAX_VIBRATO_SEMITONES);
    expect(setVibratoSemitones(-5)).toBe(MIN_VIBRATO_SEMITONES);
  });

  it('falls back to the default rather than trusting nonsense', () => {
    expect(setVibratoSemitones(Number.NaN)).toBe(DEFAULT_VIBRATO_SEMITONES);
  });

  it('hands every caller the same width, so they agree what a note is', () => {
    setVibratoSemitones(0.4);
    expect(segmentOptions().vibratoSemitones).toBe(0.4);
  });

  it('hands them every other knob too, for the same reason', () => {
    // There are three places that segment notes. They have to agree about
    // what a note is, and that is now more than one number.
    const options = segmentOptions();
    for (const knob of SEGMENT_KNOBS) {
      expect(typeof options[knob.key]).toBe('number');
    }
  });
});
