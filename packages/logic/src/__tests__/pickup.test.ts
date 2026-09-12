/**
 * The count-in — INV-NOTES-250..253.
 *
 * The steadiest-run tests are the point. A pass begins before the hand has
 * settled and ends after it has stopped meaning it, and those are exactly
 * the taps a person would not defend.
 */
import {
  movePickup,
  pickupBeats,
  pickupFrom,
  pickupStartMs,
  steadiestPulseMs,
  withPickupBeats
} from '../pickup';

/** Taps at the running sum of these gaps. */
const walk = (gaps: readonly number[], from = 0): number[] => {
  const out = [from];
  let at = from;
  for (const gap of gaps) {
    at += gap;
    out.push(at);
  }
  return out;
};

describe('steadiestPulseMs', () => {
  it('says nothing about a pass of two taps', () => {
    expect(steadiestPulseMs([0, 500])).toBeNull();
  });

  it('reads a steady pass as the pulse it was tapped at', () => {
    expect(steadiestPulseMs(walk([500, 500, 500, 500]))).toBe(500);
  });

  it('ignores the fumble at the start of a pass', () => {
    // Pressed play, waited, found the beat, then counted.
    expect(steadiestPulseMs(walk([1400, 800, 500, 500, 500, 500]))).toBe(500);
  });

  it('ignores the trail-off at the end of a pass', () => {
    // Counted, then reached for stop.
    expect(steadiestPulseMs(walk([500, 500, 500, 500, 900, 1600]))).toBe(500);
  });

  it('ignores ragged ends at both ends at once', () => {
    expect(
      steadiestPulseMs(walk([1200, 700, 480, 500, 520, 500, 1100]))
    ).toBeCloseTo(500, 0);
  });

  it('refuses a pass with no steady run in it at all', () => {
    expect(steadiestPulseMs(walk([300, 900, 400, 1300]))).toBeNull();
  });

  it('takes the longer of two steady runs', () => {
    // A short steady bit, then a longer one at a different speed.
    const pulse = steadiestPulseMs(walk([900, 900, 1700, 400, 400, 400, 400]));
    expect(pulse).toBe(400);
  });

  it('reads taps given out of order', () => {
    expect(steadiestPulseMs([1500, 0, 1000, 500])).toBe(500);
  });
});

describe('a pickup', () => {
  it('is refused where the taps say nothing', () => {
    expect(pickupFrom([0, 500], 4)).toBeNull();
  });

  it('is refused where no beats were asked for', () => {
    expect(pickupFrom(walk([500, 500, 500]), 0)).toBeNull();
  });

  it('sits immediately before the take by default', () => {
    const made = pickupFrom(walk([500, 500, 500]), 4)!;
    expect(made.endMs).toBe(0);
    expect(pickupStartMs(made)).toBe(-2000);
  });

  it('puts its beats at negative moments, in time order', () => {
    const made = pickupFrom(walk([500, 500, 500]), 3)!;
    expect(pickupBeats(made)).toEqual([-1500, -1000, -500]);
  });

  it('has no beats at all when there is no pickup', () => {
    expect(pickupBeats(null)).toEqual([]);
    expect(pickupStartMs(null)).toBe(0);
  });

  it('reaches into the take only when it is moved there', () => {
    const made = pickupFrom(walk([500, 500, 500]), 2)!;
    expect(pickupBeats(made).every((ms) => ms < 0)).toBe(true);
    const over = movePickup(made, 600);
    expect(pickupBeats(over).some((ms) => ms >= 0)).toBe(true);
  });

  it('keeps its pulse and its end when its length changes', () => {
    const made = pickupFrom(walk([500, 500, 500]), 2)!;
    const longer = withPickupBeats(made, 4)!;
    expect(longer.beatMs).toBe(made.beatMs);
    expect(longer.endMs).toBe(made.endMs);
    expect(pickupStartMs(longer)).toBe(-2000);
  });

  it('is nothing rather than a count of no length', () => {
    const made = pickupFrom(walk([500, 500, 500]), 2)!;
    expect(withPickupBeats(made, 0)).toBeNull();
  });
});

describe('where a new count ends (INV-NOTES-252)', () => {
  const steady = walk([500, 500, 500]);

  it('ends where the singing starts, not where the recording does', () => {
    // A person presses record, waits, then comes in: a count ending at
    // zero counts in nothing but silence.
    const made = pickupFrom(steady, 4, 3200)!;
    expect(made.endMs).toBe(3200);
    expect(pickupStartMs(made)).toBe(1200);
  });

  it('still ends at zero for a take whose singing starts at once', () => {
    expect(pickupFrom(steady, 4, 0)!.endMs).toBe(0);
  });

  it('keeps its beats evenly spaced wherever it ends', () => {
    const made = pickupFrom(steady, 4, 3200)!;
    const beats = pickupBeats(made);
    expect(beats).toEqual([1200, 1700, 2200, 2700]);
    // Four clicks, and the singer comes in on the next: that is a count-in.
    expect(beats[beats.length - 1] + made.beatMs).toBe(made.endMs);
  });
});
