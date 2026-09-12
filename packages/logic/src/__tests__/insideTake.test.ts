/**
 * INV-NOTES-253 — nothing of the take goes into the count-in.
 *
 * The count is empty by construction: it is counted, not sung. A note or a
 * beat inside it would claim something was performed in a place where, by
 * definition, nothing was.
 */
import { insideTake, movePickup, pickupBeats, pickupFrom } from '../pickup';

describe('insideTake', () => {
  it('holds a moment dragged back at the start of the take', () => {
    expect(insideTake(-1500)).toBe(0);
  });

  it('leaves a moment inside the take alone', () => {
    expect(insideTake(2400)).toBe(2400);
  });

  it('holds the very first moment of the take', () => {
    expect(insideTake(0)).toBe(0);
  });
});

describe('the count and the take', () => {
  const made = pickupFrom([0, 500, 1000, 1500], 4)!;

  it('keeps the count entirely in front of the take by default', () => {
    expect(pickupBeats(made).every((ms) => ms < 0)).toBe(true);
  });

  it('lets the count reach the take only by being moved there', () => {
    // Moving the count is the one way to say the two overlap, and it is a
    // statement about the count rather than about the recording.
    const over = movePickup(made, 1000);
    expect(pickupBeats(over).some((ms) => ms >= 0)).toBe(true);
  });

  it('moves nothing of the take when the count is moved over it', () => {
    const over = movePickup(made, 1000);
    // The clamp is about what a finger may place, not about what the count
    // covers: a count dragged over the take does not push anything.
    expect(insideTake(200)).toBe(200);
    expect(over.beatMs).toBe(made.beatMs);
  });
});
