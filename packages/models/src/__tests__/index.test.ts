import { NOTE_NAMES } from '../index';

describe('NOTE_NAMES', () => {
  it('has 12 chromatic names starting at C', () => {
    expect(NOTE_NAMES).toHaveLength(12);
    expect(NOTE_NAMES[0]).toBe('C');
    expect(NOTE_NAMES[9]).toBe('A');
  });
});
