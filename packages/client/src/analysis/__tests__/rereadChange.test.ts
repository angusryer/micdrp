/**
 * INV-NOTES-262 — a take says beforehand what reading it again would do.
 *
 * Three answers and the order they are given in: an older listener changes
 * the reading whatever the thresholds say, so stale comes first; a take that
 * carries no thresholds cannot say what it was read with, so it is retuned
 * by definition; and only a take at the current version whose thresholds
 * match what a reading made now would be stamped with is unchanged.
 */
import { ANALYSIS_VERSION } from 'logic';

import type { NoteMeta } from '../../data/notesCache';
import { rereadChange } from '../rereadNote';
import { currentReadWith, resetTakeKnobs } from '../takeKnobs';
import { resetKnobs } from '../readingValues';

const note = (over: Partial<NoteMeta>): NoteMeta =>
  ({
    id: 'n1',
    title: 't',
    createdAtMs: 0,
    durationMs: 1000,
    sampleRateHz: 48000,
    audioPath: null,
    melody: [],
    noteCount: 0,
    analysisVersion: ANALYSIS_VERSION,
    ...over
  }) as NoteMeta;

beforeEach(() => {
  resetKnobs();
  resetTakeKnobs('n1');
});

describe('rereadChange', () => {
  it('is stale for a take read by an older listener, whatever its thresholds', () => {
    const now = currentReadWith('n1');
    expect(rereadChange(note({ analysisVersion: ANALYSIS_VERSION - 1, readWith: now }))).toBe(
      'stale'
    );
  });

  it('is retuned for a take that carries no thresholds at all', () => {
    expect(rereadChange(note({ readWith: {} }))).toBe('retuned');
  });

  it('is unchanged when the thresholds match what a reading now would stamp', () => {
    expect(rereadChange(note({ readWith: currentReadWith('n1') }))).toBe('unchanged');
  });

  it('is retuned when any one threshold has moved since', () => {
    const was = currentReadWith('n1');
    const [first] = Object.keys(was);
    expect(rereadChange(note({ readWith: { ...was, [first]: was[first] + 1 } }))).toBe(
      'retuned'
    );
  });
});
