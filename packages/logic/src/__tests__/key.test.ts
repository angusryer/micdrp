import { detectKey } from '../key';
import type { PitchFrame, NoteEvent } from '../segmentation';

function frame(timestampMs: number, midi: number | null): PitchFrame {
  return { timestampMs, midi, cents: 0, clarity: 0.95 };
}

function note(midi: number, durationMs: number): NoteEvent {
  return {
    midi,
    startMs: 0,
    endMs: durationMs,
    durationMs,
    cents: 0,
    clarity: 0.95
  };
}

describe('detectKey', () => {
  it('resolves a C-major scale to C major', () => {
    // C D E F G A B C across octave 4 (MIDI 60..72), emphasising the tonic
    // and dominant the way a real major-key passage does.
    const scale = [60, 62, 64, 65, 67, 69, 71, 72];
    const frames: PitchFrame[] = [];
    let t = 0;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < scale.length; i++) {
        frames.push(frame(t, scale[i]));
        t += 100;
      }
    }
    // Linger on the tonic to anchor the key.
    for (let i = 0; i < 8; i++) {
      frames.push(frame(t, 60));
      t += 100;
    }

    const key = detectKey(frames);
    expect(key.tonic).toBe(0);
    expect(key.tonicName).toBe('C');
    expect(key.mode).toBe('major');
    expect(key.confidence).toBeGreaterThan(0);
  });

  it('resolves an A-minor passage to A minor', () => {
    // A natural-minor scale (A B C D E F G), tonic-weighted.
    const scale = [69, 71, 72, 74, 76, 77, 79];
    const notes: NoteEvent[] = [];
    for (let i = 0; i < scale.length; i++) {
      notes.push(note(scale[i], 300));
    }
    // Extra weight on the A-minor tonic triad (A, C, E).
    notes.push(note(69, 900));
    notes.push(note(72, 600));
    notes.push(note(76, 600));

    const key = detectKey(notes);
    expect(key.tonic).toBe(9); // A
    expect(key.tonicName).toBe('A');
    expect(key.mode).toBe('minor');
  });

  it('weights NoteEvent input by duration', () => {
    // A short off-key note should not outvote a long tonic-establishing one.
    const notes: NoteEvent[] = [
      note(67, 50), // brief G
      note(60, 2000), // sustained C
      note(64, 1500), // sustained E
      note(67, 1500) // sustained G -> C major triad dominates
    ];
    const key = detectKey(notes);
    expect(key.tonic).toBe(0);
    expect(key.mode).toBe('major');
  });

  it('handles octave-spanning pitch classes', () => {
    // Same pitch classes across octaves fold into one histogram.
    const notes: NoteEvent[] = [
      note(48, 500), // C3
      note(72, 500), // C5
      note(64, 500), // E4
      note(67, 500) // G4
    ];
    const key = detectKey(notes);
    expect(key.tonicName).toBe('C');
  });

  it('returns C major with zero confidence for empty input', () => {
    const key = detectKey([]);
    expect(key.tonic).toBe(0);
    expect(key.mode).toBe('major');
    expect(key.confidence).toBe(0);
  });

  it('returns zero confidence when every frame is unvoiced', () => {
    const frames: PitchFrame[] = [frame(0, null), frame(100, null)];
    const key = detectKey(frames);
    expect(key.confidence).toBe(0);
  });

  it('produces confidence within [0, 1]', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71];
    const frames = scale.map((m, i) => frame(i * 100, m));
    const key = detectKey(frames);
    expect(key.confidence).toBeGreaterThanOrEqual(0);
    expect(key.confidence).toBeLessThanOrEqual(1);
  });
});
