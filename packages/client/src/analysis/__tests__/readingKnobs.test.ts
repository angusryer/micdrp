/**
 * INV-NOTES-172 — every threshold the reading turns on is adjustable.
 *
 * Every number, because the one that matters is never the one you expected.
 * Half the surface exposed is a search with half its dimensions missing, and
 * the missing one is where the fault turns out to live.
 */
const mockStore = new Map<string, unknown>();
jest.mock('../../data/store', () => ({
  getJSON: (key: string) => mockStore.get(key),
  setJSON: (key: string, value: unknown) => mockStore.set(key, value)
}));

import { READING_KNOBS, knobRank } from '../knobOrder';
import {
  knobValue,
  readingOptions,
  resetKnobs,
  setKnobValue
} from '../readingValues';

beforeEach(() => mockStore.clear());

describe('the knobs', () => {
  it('covers every part of the reading', () => {
    const covered = new Set(READING_KNOBS.map((k) => k.group));
    for (const group of ['smooth', 'segment', 'bends', 'top', 'percussion']) {
      expect(covered.has(group as never)).toBe(true);
    }
  });

  it('puts the ones that move a whistled reading first', () => {
    // Whistling scoops into pitch, so how much movement is still one note is
    // what decides whether a scoop becomes three notes. A re-attack on the
    // breath is something whistling never does.
    const order = READING_KNOBS.map((k) => k.key);
    expect(order.indexOf('pitchHoldMs')).toBeLessThan(
      order.indexOf('aspirationRiseDb')
    );
    expect(order.indexOf('vibratoSemitones')).toBeLessThan(
      order.indexOf('onsetWindowMs')
    );
    expect(order.indexOf('minMoveSemitones')).toBeLessThan(
      order.indexOf('aspirationRiseDb')
    );
  });

  it('leaves the breath-push knobs last, since a tongue never swells', () => {
    // A tongue stops the air and releases it. The rise that follows a note
    // pushed again on the breath almost never fires for this player.
    const order = READING_KNOBS.map((k) => k.key);
    expect(order[order.length - 1]).toBe('onsetWindowMs');
    expect(order[order.length - 2]).toBe('aspirationRiseDb');
  });

  it('puts the level knobs high, because a tongued repeat has no pitch clue', () => {
    // On a repeated note the pitch trace runs straight through the tap, so
    // the dip in level is the only evidence there are two notes at all.
    const order = READING_KNOBS.map((k) => k.key);
    expect(order.indexOf('articulationDropDb')).toBeLessThan(3);
    expect(order.indexOf('maxGapMs')).toBeLessThan(3);
  });

  it('ranks every knob it declares', () => {
    // An unranked knob falls to the end silently, which is how one goes
    // missing from the order without anybody noticing.
    for (const knob of READING_KNOBS) {
      expect(knobRank(knob)).toBeLessThan(READING_KNOBS.length);
    }
  });

  it('says what moving each one does', () => {
    // A row of numbers with no words is a search nobody can steer.
    for (const knob of READING_KNOBS) {
      expect(knob.title.length).toBeGreaterThan(0);
      expect(knob.hint.length).toBeGreaterThan(20);
    }
  });

  it('gives every knob a range its default sits inside', () => {
    for (const knob of READING_KNOBS) {
      expect(knob.min).toBeLessThan(knob.max);
      expect(knob.fallback).toBeGreaterThanOrEqual(knob.min);
      expect(knob.fallback).toBeLessThanOrEqual(knob.max);
    }
  });

  it('keeps two knobs of the same name apart', () => {
    // `minClarity` means one thing to the smoother and would mean another
    // elsewhere; the group is part of where it lives.
    const keys = READING_KNOBS.map((k) => `${k.group}.${k.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('what is currently set', () => {
  it('starts at the default', () => {
    for (const knob of READING_KNOBS) {
      expect(knobValue(knob)).toBe(knob.fallback);
    }
  });

  it('brings an out-of-range value into range rather than refusing it', () => {
    const knob = READING_KNOBS[0];
    expect(setKnobValue(knob, knob.max + 100)).toBe(knob.max);
    expect(setKnobValue(knob, knob.min - 100)).toBe(knob.min);
  });

  it('puts them all back', () => {
    const knob = READING_KNOBS[0];
    setKnobValue(knob, knob.max);
    resetKnobs();
    expect(knobValue(knob)).toBe(knob.fallback);
  });

  it('keeps a segmentation knob somebody had already tuned', () => {
    // The segmentation knobs kept their old home, so a mix already tuned is
    // not silently reset by the move into this table.
    const knob = READING_KNOBS.find((k) => k.key === 'minDurationMs');
    mockStore.set('analysis.segment.minDurationMs', 120);
    expect(knobValue(knob!)).toBe(120);
  });
});

describe('the reading assembled from them', () => {
  it('hands each group to the part it belongs to', () => {
    const options = readingOptions();
    expect(options.smooth).toHaveProperty('windowSize');
    expect(options.segment).toHaveProperty('minDurationMs');
    expect(options.bends).toHaveProperty('maxJoinGapMs');
    expect(options.percussion).toHaveProperty('minLevelDb');
    expect(typeof options.minArticulationMs).toBe('number');
  });

  it('reads what was set rather than what was declared', () => {
    const knob = READING_KNOBS.find((k) => k.key === 'minDurationMs');
    setKnobValue(knob!, 150);
    expect(readingOptions().segment.minDurationMs).toBe(150);
  });
});
