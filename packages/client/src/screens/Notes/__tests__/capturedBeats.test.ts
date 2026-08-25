/**
 * INV-NOTES-137 — the beat is tapped in while the take is being sung.
 *
 * Tapping existed only against a take being played back. But the moment a
 * person is surest where the pulse is, is while they are singing to it —
 * asking them to sing it, open it, play it and tap along is asking for the
 * performance twice, and the second one is the one being measured.
 */
import { beatFromTap } from 'logic';

import { firstInterpretation } from '../capturedBeats';

describe('the reading a freshly sung note opens with', () => {
  it('carries the beats that were tapped while singing', () => {
    const beats = [beatFromTap(500), beatFromTap(1000)];
    expect(firstInterpretation(beats, 1).beats).toEqual([
      { atMs: 500, tappedAtMs: 500, isDownbeat: false },
      { atMs: 1000, tappedAtMs: 1000, isDownbeat: false }
    ]);
  });

  it('is not frozen: it is where corrections will go', () => {
    // A frozen reading is one kept aside from re-analysis. This is the live
    // one — the first, not a version.
    expect(firstInterpretation([], 1).isFrozen).toBe(false);
  });

  it('claims nothing about the harmony nobody has looked at yet', () => {
    expect(firstInterpretation([beatFromTap(0)], 1).chords).toEqual([]);
  });

  it('copies the beats rather than holding the caller’s array', () => {
    // The capture keeps tapping into its own list; a reading that shared it
    // would keep changing after it was written.
    const beats = [beatFromTap(500)];
    const reading = firstInterpretation(beats, 1);
    beats[0].atMs = 9999;
    expect(reading.beats?.[0].atMs).toBe(500);
  });
});
