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

describe('INV-NOTES-105: the reading is quieter than the performance', () => {
  /** Saturation and lightness of a hex colour, 0..1. */
  const hsl = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255
    );
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    return {
      s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)),
      l,
      hue: max === r ? (g - b) / (d || 1) : max === g ? 2 + (b - r) / (d || 1) : 4 + (r - g) / (d || 1)
    };
  };

  const roles = [0, 1, 2, 3, 4].map(chordRoleColour);

  it('draws the chords muted, not at full strength', () => {
    // The chords are what the take implied. The sung line and the hummed
    // bass are what someone performed, and the performance is what the eye
    // should land on first.
    for (const colour of roles) {
      expect(hsl(colour).s).toBeLessThan(0.65);
    }
  });

  it('keeps them light enough to read on a dark ground', () => {
    for (const colour of roles) {
      expect(hsl(colour).l).toBeGreaterThan(0.5);
    }
  });

  it('still holds the parts apart by hue', () => {
    // Muting is a change of strength, not of identity: which part a note
    // plays is still readable at a glance (INV-NOTES-052).
    const hues = roles.map((c) => hsl(c).hue).sort((a, b) => a - b);
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i] - hues[i - 1]).toBeGreaterThan(0.3);
    }
  });
});
