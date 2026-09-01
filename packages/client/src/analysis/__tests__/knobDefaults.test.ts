/**
 * INV-NOTES-187 — a knob's default is the reading's own default.
 *
 * "Too brief to have been intended" was declared at 70ms beside a library
 * that defaults it to 90. Turning the knobs and pressing "back to defaults"
 * therefore did not go back: it went to a reading the take had never had, and
 * the original could not be recovered from inside the app at all.
 */
import { READ_DEFAULTS, readTake } from 'logic';
import type { PitchFrame } from 'logic';

import { READING_KNOBS } from '../knobOrder';
import { readingOptions } from '../readingValues';
import { resetKnobs } from '../readingValues';

/** The library's own default for a knob, by the group it belongs to. */
const libraryDefault = (group: string, key: string): number | undefined => {
  const groups = READ_DEFAULTS as unknown as Record<
    string,
    Record<string, number> | number
  >;
  if (group === 'top') {
    return READ_DEFAULTS.minArticulationMs;
  }
  const inGroup = groups[group];
  return typeof inGroup === 'object' ? inGroup[key] : undefined;
};

describe('what a knob goes back to', () => {
  it.each(READING_KNOBS.map((k) => [`${k.group}.${k.key}`, k] as const))(
    '%s is the reading\'s own default, not a copy of it',
    (_name, knob) => {
      expect(knob.fallback).toBe(libraryDefault(knob.group, knob.key));
    }
  );

  it('has a library default for every knob it offers', () => {
    // A knob wired to nothing would pass the check above by comparing
    // undefined with undefined.
    for (const knob of READING_KNOBS) {
      expect(libraryDefault(knob.group, knob.key)).toBeDefined();
    }
  });
});

const HOP = 10;
const frames = (count: number, at: number, make: () => Partial<PitchFrame>): PitchFrame[] =>
  Array.from({ length: count }, (_, i) => ({
    timestampMs: at + i * HOP,
    midi: null,
    cents: null,
    clarity: 0,
    levelDb: -75,
    centroidHz: 0,
    flatness: 0,
    ...make()
  }));

const sung = (at: number, ms: number) =>
  frames(Math.ceil(ms / HOP), at, () => ({
    midi: 62,
    cents: 0,
    clarity: 0.95,
    levelDb: -14,
    centroidHz: 294,
    flatness: 0.02
  }));

describe('putting the knobs back', () => {
  it('reads a take exactly as reading it with no options at all does', () => {
    // Which is what "back to defaults" has to mean, or the reading a take was
    // first given can never be recovered.
    resetKnobs();
    const take = [...sung(0, 400), ...frames(20, 400, () => ({})), ...sung(600, 400)];
    expect(readTake(take, 'mixed', readingOptions()).notes).toEqual(
      readTake(take, 'mixed').notes
    );
  });
});
