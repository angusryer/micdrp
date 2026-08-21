/**
 * Where a readout sits while a finger drags — INV-NOTES-025.
 *
 * The property is simple and the edges are not: it must never end up under
 * the finger, and it must never end up off the screen either. Testing the
 * math rather than the pixels is what makes the corners checkable at all.
 */
import { coversTouch, LOUPE_OFFSET, placeLoupe } from '../loupePosition';

const SCREEN = { width: 390, height: 844 };
const SIZE = { loupeWidth: 140, loupeHeight: 56 };
/** A melody strip: shorter than the readout plus its clearance. */
const STRIP = {
  width: 356,
  height: 150,
  top: -(SIZE.loupeHeight + LOUPE_OFFSET)
};

describe('placeLoupe', () => {
  it('INV-NOTES-025: never sits under the finger', () => {
    // Swept across the whole screen rather than spot-checked: the failure
    // this guards against is a corner nobody thought to try.
    for (let x = 0; x <= SCREEN.width; x += 10) {
      for (let y = 0; y <= SCREEN.height; y += 20) {
        const placement = placeLoupe(x, y, SCREEN, SIZE);
        expect(coversTouch(placement, x, y, SIZE)).toBe(false);
      }
    }
  });

  it('never goes off the screen', () => {
    for (let x = 0; x <= SCREEN.width; x += 10) {
      for (let y = 0; y <= SCREEN.height; y += 20) {
        const { x: px, y: py } = placeLoupe(x, y, SCREEN, SIZE);
        expect(px).toBeGreaterThanOrEqual(0);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(px + SIZE.loupeWidth).toBeLessThanOrEqual(SCREEN.width);
        expect(py + SIZE.loupeHeight).toBeLessThanOrEqual(SCREEN.height);
      }
    }
  });

  it('sits above the finger when there is room', () => {
    const { y } = placeLoupe(100, 400, SCREEN, SIZE);
    expect(y + SIZE.loupeHeight).toBeLessThan(400);
  });

  it('drops below the finger near the top, rather than off the screen', () => {
    const { y } = placeLoupe(100, 10, SCREEN, SIZE);
    expect(y).toBeGreaterThan(10);
  });

  it('prefers the right of the finger, which suits a right hand', () => {
    expect(placeLoupe(100, 400, SCREEN, SIZE).side).toBe('right');
  });

  it('flips to the left near the right edge rather than sliding off', () => {
    const placement = placeLoupe(380, 400, SCREEN, SIZE);
    expect(placement.side).toBe('left');
    expect(placement.x + SIZE.loupeWidth).toBeLessThanOrEqual(SCREEN.width);
  });

  it('still clears the finger in the corners', () => {
    for (const [x, y] of [[0, 0], [389, 0], [0, 843], [389, 843]]) {
      expect(coversTouch(placeLoupe(x, y, SCREEN, SIZE), x, y, SIZE)).toBe(false);
    }
  });

  it('rises above a surface too short to hold it clear of the finger', () => {
    // Clamped inside the strip it would settle level with the thumb —
    // offset sideways by the letter of INV-NOTES-025, under the hand in
    // fact. With top granted, it clears the finger vertically everywhere.
    for (let x = 0; x <= STRIP.width; x += 10) {
      for (let y = 0; y <= STRIP.height; y += 10) {
        const placement = placeLoupe(x, y, STRIP, SIZE);
        expect(placement.y + SIZE.loupeHeight).toBeLessThan(y);
        expect(placement.y).toBeGreaterThanOrEqual(STRIP.top);
      }
    }
  });

  it('copes with a readout larger than the space it has', () => {
    // Clamping must not produce a negative position, whatever it is given.
    const tiny = { width: 100, height: 40 };
    const { x, y } = placeLoupe(50, 20, tiny, SIZE);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });
});
