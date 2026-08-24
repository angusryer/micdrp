/**
 * INV-NOTES-116 — which reading a stored take was given.
 *
 * Staleness has to be a fact rather than a guess. Without a version, the app
 * can only offer a re-read on every take in the library and hope, which trains
 * a person to ignore the offer.
 */
import { ANALYSIS_VERSION, isStale } from '../analysisVersion';

describe('the reading a take was given', () => {
  it('counts a take with no version as the oldest one', () => {
    // Everything captured before the version existed got the reading of that
    // time, which is exactly what "oldest" means.
    expect(isStale(undefined)).toBe(true);
    expect(isStale(null)).toBe(true);
  });

  it('counts a take read by this engine as current', () => {
    expect(isStale(ANALYSIS_VERSION)).toBe(false);
  });

  it('counts anything earlier as stale', () => {
    expect(isStale(ANALYSIS_VERSION - 1)).toBe(true);
  });

  it('does not call a take from the future stale', () => {
    // A bundle can be older than the take it is reading, after a rollback.
    // Offering to "improve" it by re-reading with an older engine would be
    // the one case where re-reading makes things worse.
    expect(isStale(ANALYSIS_VERSION + 1)).toBe(false);
  });

  it('moves forward only', () => {
    expect(ANALYSIS_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(ANALYSIS_VERSION)).toBe(true);
  });
});
