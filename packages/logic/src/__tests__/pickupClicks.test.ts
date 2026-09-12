/**
 * INV-NOTES-265 — with a count-in, the click sounds the count's beats and
 * nothing else.
 */
import { pickupClicks } from '../bassContext';
import { pickupBeats } from '../pickup';

describe('pickupClicks', () => {
  const count = { beats: 4, beatMs: 500, endMs: 0 };

  it('clicks once per beat of the count, all before the take', () => {
    const { clicks } = pickupClicks(pickupBeats(count));
    expect(clicks).toHaveLength(4);
    expect(clicks.map((c) => c.startMs)).toEqual([-2000, -1500, -1000, -500]);
    expect(clicks.every((c) => c.endMs <= 0)).toBe(true);
  });

  it('sounds the first beat of the count as its downbeat', () => {
    const { clicks } = pickupClicks(pickupBeats(count));
    expect(clicks[0].midi).not.toBe(clicks[1].midi);
    expect(clicks[1].midi).toBe(clicks[2].midi);
  });

  it('waits for nothing: the count is transport time', () => {
    expect(pickupClicks(pickupBeats(count)).leadInMs).toBe(0);
  });

  it('is silent for a take with no count', () => {
    expect(pickupClicks([]).clicks).toEqual([]);
  });
});
