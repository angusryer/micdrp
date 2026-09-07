/**
 * ACC-NOTES-230 / ACC-NOTES-231 — INV-NOTES-216, INV-NOTES-217.
 *
 * Every threshold the reader turns on lived once for the whole app, so a
 * recording made in August was read again with a tuning arrived at in
 * September against a different take — sung differently, at a different
 * distance from the microphone — and came back as a different melody with
 * nothing anywhere to say it had been read under settings never chosen for
 * it.
 *
 * The fault is not that the numbers were wrong. It is that a value edited
 * while looking at one take reached backwards into every other, and the
 * reading it produced looked exactly like a reading that had been asked for.
 */
import { READING_KNOBS } from '../knobOrder';
import { knobScope } from '../knobScope';
import { knobValue, setKnobValue } from '../readingValues';
import { readingOptions } from '../readingValues';
import {
  hasTakeKnobs,
  resetTakeKnobs,
  restoreReadWith,
  seedReadWith,
  setTakeKnobValue,
  stampReadWith,
  takeKnobValue,
  takeReadWith
} from '../takeKnobs';

const AUGUST = 'take-from-august';
const SEPTEMBER = 'take-from-september';

/** A knob with room to move on both sides, so a test can tell moves apart. */
const KNOB = READING_KNOBS.find(
  (k) => k.key === 'pitchHoldMs' && k.group === 'segment'
)!;

beforeEach(() => {
  resetTakeKnobs(AUGUST);
  resetTakeKnobs(SEPTEMBER);
  setKnobValue(KNOB, KNOB.fallback);
});

describe('a take with no settings of its own', () => {
  it('is read with the app-wide value', () => {
    setKnobValue(KNOB, KNOB.fallback + 10);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 10);
  });

  it('says it has none, rather than reporting the borrowed value as its own', () => {
    expect(hasTakeKnobs(AUGUST)).toBe(false);
  });
});

describe('ACC-NOTES-230: a take read with its own settings', () => {
  it('keeps them when the app-wide value moves', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 5);
    setKnobValue(KNOB, KNOB.fallback + 40);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 5);
  });

  it('hands those values to the reader, not the app-wide ones', () => {
    // The whole point: readingOptions is what readTake is given, so this is
    // the assertion that the take is actually read differently.
    setKnobValue(KNOB, KNOB.fallback + 40);
    const mine = readingOptions({ 'segment.pitchHoldMs': KNOB.fallback + 5 });
    expect(mine.segment.pitchHoldMs).toBe(KNOB.fallback + 5);
  });

  it('falls through per knob, not all or nothing', () => {
    // A take stamped before a knob existed must not read that knob as zero.
    setKnobValue(KNOB, KNOB.fallback + 12);
    const options = readingOptions({ 'smooth.windowSize': 3 });
    expect(options.segment.pitchHoldMs).toBe(KNOB.fallback + 12);
    expect(options.smooth.windowSize).toBe(3);
  });

  it('refuses a stored value that is not a number', () => {
    const options = readingOptions({
      'segment.pitchHoldMs': Number.NaN
    } as Record<string, number>);
    expect(options.segment.pitchHoldMs).toBe(knobValue(KNOB));
  });

  it('brings an out-of-range stored value into range', () => {
    const options = readingOptions({ 'segment.pitchHoldMs': 10 ** 9 });
    expect(options.segment.pitchHoldMs).toBe(KNOB.max);
  });
});

describe('stamping what a reading was made with', () => {
  it('records every knob, not only the ones turned', () => {
    const stamp = stampReadWith(AUGUST);
    expect(Object.keys(stamp).length).toBe(READING_KNOBS.length);
  });

  it('freezes the app-wide values as they were at that moment', () => {
    setKnobValue(KNOB, KNOB.fallback + 7);
    stampReadWith(AUGUST);
    setKnobValue(KNOB, KNOB.fallback + 30);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 7);
  });
});

describe('settings that arrive with a note', () => {
  it('are taken where the device has none — which is after a reinstall', () => {
    seedReadWith(AUGUST, { 'segment.pitchHoldMs': KNOB.fallback + 3 });
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 3);
  });

  it('do not overwrite what is being turned here', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 5);
    seedReadWith(AUGUST, { 'segment.pitchHoldMs': KNOB.fallback + 3 });
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 5);
  });

  it('are ignored when they are not settings at all', () => {
    seedReadWith(AUGUST, 'not settings');
    expect(hasTakeKnobs(AUGUST)).toBe(false);
  });

  it('are overwritten by a restore, which is undoing a reading', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 5);
    restoreReadWith(AUGUST, { 'segment.pitchHoldMs': KNOB.fallback + 3 });
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 3);
  });
});

describe('ACC-NOTES-231: turning a knob beside one take', () => {
  it('leaves the app-wide value alone', () => {
    knobScope(AUGUST).set(KNOB, KNOB.fallback + 5);
    expect(knobValue(KNOB)).toBe(KNOB.fallback);
  });

  it('leaves every other take alone', () => {
    stampReadWith(SEPTEMBER);
    knobScope(AUGUST).set(KNOB, KNOB.fallback + 5);
    expect(takeKnobValue(SEPTEMBER, KNOB)).toBe(KNOB.fallback);
  });

  it('says which it is changing', () => {
    expect(knobScope(AUGUST).says).toMatch(/this take only/);
  });
});

describe('and turning one with no take in view', () => {
  it('changes the app-wide value', () => {
    knobScope(null).set(KNOB, KNOB.fallback + 5);
    expect(knobValue(KNOB)).toBe(KNOB.fallback + 5);
  });

  it('still does not reach a take that has its own', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 2);
    knobScope(null).set(KNOB, KNOB.fallback + 5);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 2);
  });

  it('says it is where a new take starts', () => {
    expect(knobScope(null).says).toMatch(/where a new take starts/);
  });

  it('resets only what is in scope', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 2);
    setKnobValue(KNOB, KNOB.fallback + 9);
    knobScope(null).reset();
    expect(knobValue(KNOB)).toBe(KNOB.fallback);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 2);
  });
});

describe('putting a take back on the app settings', () => {
  it('drops its own values rather than freezing today’s', () => {
    setTakeKnobValue(AUGUST, KNOB, KNOB.fallback + 5);
    resetTakeKnobs(AUGUST);
    setKnobValue(KNOB, KNOB.fallback + 11);
    expect(takeKnobValue(AUGUST, KNOB)).toBe(KNOB.fallback + 11);
    expect(takeReadWith(AUGUST)).toEqual({});
  });
});
