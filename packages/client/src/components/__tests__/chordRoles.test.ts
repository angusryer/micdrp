/**
 * A chord's notes are coloured by the part they play (INV-NOTES-052).
 */
import { chordRoleAt, chordRoleColour } from '../chordRoles';

describe('which part a note plays', () => {
  it('reads it from the position in the chord, root first', () => {
    expect(chordRoleAt(0)).toBe('root');
    expect(chordRoleAt(1)).toBe('third');
    expect(chordRoleAt(2)).toBe('fifth');
    expect(chordRoleAt(3)).toBe('seventh');
  });

  it('has something to say about a note past the seventh', () => {
    expect(chordRoleAt(4)).toBe('extension');
    expect(chordRoleColour(4)).toBeTruthy();
  });
});

describe('the colours that say so', () => {
  it('gives every part its own', () => {
    const used = [0, 1, 2, 3, 4].map(chordRoleColour);
    expect(new Set(used).size).toBe(used.length);
  });

  it('depends on the part and nothing else', () => {
    // The same index is the same colour whatever chord it came from, which
    // is what lets the eye follow the root across a renaming.
    expect(chordRoleColour(0)).toBe(chordRoleColour(0));
    expect(chordRoleColour(0)).not.toBe(chordRoleColour(2));
  });
});
