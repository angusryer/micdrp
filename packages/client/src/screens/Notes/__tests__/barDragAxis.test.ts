/**
 * Which way a bar-line drag is going, and whether letting go discards it
 * (INV-NOTES-046, INT-NOTES-014).
 */
import {
  AXIS_AWAY,
  AXIS_DEADZONE,
  AXIS_MOVE,
  AXIS_NONE,
  chooseAxis,
  shouldDiscard
} from '../barDragAxis';

const FLICK = 900;

describe('a drag commits to one direction and keeps it', () => {
  it('waits for real movement before choosing at all', () => {
    expect(chooseAxis(AXIS_NONE, 0, 0)).toBe(AXIS_NONE);
    expect(chooseAxis(AXIS_NONE, AXIS_DEADZONE, AXIS_DEADZONE)).toBe(AXIS_NONE);
    expect(chooseAxis(AXIS_NONE, AXIS_DEADZONE + 1, 0)).toBe(AXIS_MOVE);
  });

  it('reads the larger movement as the intent', () => {
    expect(chooseAxis(AXIS_NONE, 40, 10)).toBe(AXIS_MOVE);
    expect(chooseAxis(AXIS_NONE, 10, -40)).toBe(AXIS_AWAY);
    // Sideways wins a tie: it is the direction you can take back.
    expect(chooseAxis(AXIS_NONE, 30, 30)).toBe(AXIS_MOVE);
  });

  it('keeps its choice however the thumb wanders afterwards', () => {
    // A sideways drag that drifts far upward is still a move, not a delete —
    // a thumb crossing a phone rises and falls without being asked to.
    expect(chooseAxis(AXIS_MOVE, 40, -300)).toBe(AXIS_MOVE);
    expect(chooseAxis(AXIS_AWAY, 300, -40)).toBe(AXIS_AWAY);
  });

  it('chooses upward for a downward-then-upward flick by magnitude', () => {
    expect(chooseAxis(AXIS_NONE, 2, -60)).toBe(AXIS_AWAY);
  });
});

describe('whether releasing takes the line away', () => {
  it('never discards a sideways drag, however fast it ends', () => {
    expect(shouldDiscard(AXIS_MOVE, 0, -5000, FLICK)).toBe(false);
    // Even one that somehow armed: the axis is the gate.
    expect(shouldDiscard(AXIS_MOVE, 1, -5000, FLICK)).toBe(false);
    expect(shouldDiscard(AXIS_NONE, 1, -5000, FLICK)).toBe(false);
  });

  it('discards a slow drag that was carried far enough', () => {
    expect(shouldDiscard(AXIS_AWAY, 1, 0, FLICK)).toBe(true);
  });

  it('discards a flick that never travelled far', () => {
    expect(shouldDiscard(AXIS_AWAY, 0, -FLICK, FLICK)).toBe(true);
    expect(shouldDiscard(AXIS_AWAY, 0, -FLICK - 1, FLICK)).toBe(true);
  });

  it('keeps a line that was neither carried far nor thrown', () => {
    expect(shouldDiscard(AXIS_AWAY, 0, -FLICK + 1, FLICK)).toBe(false);
    expect(shouldDiscard(AXIS_AWAY, 0, 0, FLICK)).toBe(false);
  });

  it('ignores downward speed entirely', () => {
    // Flicking down is not a way to delete something.
    expect(shouldDiscard(AXIS_AWAY, 0, 5000, FLICK)).toBe(false);
  });
});
