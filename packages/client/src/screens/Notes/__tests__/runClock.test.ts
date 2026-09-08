/**
 * The moment, as minutes and seconds — INV-NOTES-227.
 *
 * A worklet, so it is tested as the pure function it is. What it must never
 * become is React state: the position advances every frame, and reading the
 * clock would then re-render the graph beside it (INV-NOTES-206).
 */
import { clockLabel } from '../RunClock';

it('reads a moment as minutes and seconds', () => {
  expect(clockLabel(0)).toBe('0:00');
  expect(clockLabel(9_400)).toBe('0:09');
  expect(clockLabel(61_000)).toBe('1:01');
  expect(clockLabel(605_000)).toBe('10:05');
});

it('says the beginning rather than a negative moment', () => {
  // The head can be dragged before the start of a take.
  expect(clockLabel(-500)).toBe('0:00');
});
