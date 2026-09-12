/**
 * INV-TPORT-039 — a run may begin before the material.
 */
import { runTiming } from '../runTiming';

describe('runTiming', () => {
  it('starts the voice at once for a run from inside the take', () => {
    const t = runTiming(3000, 10000, 100);
    expect(t.offsetMs).toBe(3000);
    expect(t.waitMs).toBe(0);
    expect(t.voiceStartMs).toBe(100);
    expect(t.endMs).toBe(100 + 7000);
    // position = now − anchor: at the first instant, 3000.
    expect(100 - t.anchorMs).toBe(3000);
  });

  it('holds the voice back for a run that begins in the count-in', () => {
    const t = runTiming(-2000, 10000, 100);
    expect(t.offsetMs).toBe(0);
    expect(t.waitMs).toBe(2000);
    expect(t.voiceStartMs).toBe(2100);
    expect(t.endMs).toBe(2100 + 10000);
    // At the first instant the position is the count's first beat.
    expect(100 - t.anchorMs).toBe(-2000);
    // And when the voice begins, the position is zero.
    expect(t.voiceStartMs - t.anchorMs).toBe(0);
  });

  it('never asks the voice to start before its first sample', () => {
    expect(runTiming(-500, 10000, 0).offsetMs).toBe(0);
  });

  it('never asks the voice to start past its last sample', () => {
    expect(runTiming(50000, 10000, 0).offsetMs).toBe(9999);
  });
});
