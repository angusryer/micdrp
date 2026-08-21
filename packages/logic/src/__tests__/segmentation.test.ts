import { segmentNotes } from '../segmentation';
import type { PitchFrame } from '../segmentation';

function frame(
  timestampMs: number,
  midi: number | null,
  clarity = 0.95,
  cents = 0
): PitchFrame {
  return { timestampMs, midi, cents, clarity };
}

describe('segmentNotes', () => {
  it('splits a stream into distinct notes', () => {
    const frames: PitchFrame[] = [];
    for (let t = 0; t <= 90; t += 10) {
      frames.push(frame(t, 69));
    }
    for (let t = 100; t <= 190; t += 10) {
      frames.push(frame(t, 71));
    }
    const notes = segmentNotes(frames, { minDurationMs: 50, maxGapMs: 40 });
    expect(notes.map((n) => n.midi)).toEqual([69, 71]);
    expect(notes[0].startMs).toBe(0);
    expect(notes[0].endMs).toBe(90);
    expect(notes[0].durationMs).toBe(90);
    expect(notes[1].startMs).toBe(100);
  });

  it('drops notes shorter than minDurationMs', () => {
    const frames = [frame(0, 60), frame(10, 60)];
    expect(segmentNotes(frames, { minDurationMs: 60 })).toHaveLength(0);
  });

  it('tolerates short unvoiced gaps within a note', () => {
    const frames = [
      frame(0, 69),
      frame(10, 69),
      frame(20, 69),
      frame(30, null),
      frame(40, 69),
      frame(50, 69)
    ];
    const notes = segmentNotes(frames, { minDurationMs: 30, maxGapMs: 40 });
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(69);
    expect(notes[0].endMs).toBe(50);
  });

  it('splits on a long unvoiced gap', () => {
    const frames = [
      frame(0, 69),
      frame(10, 69),
      frame(20, 69),
      frame(30, null),
      frame(40, null),
      frame(50, null),
      frame(60, null),
      frame(70, null),
      frame(80, 69),
      frame(90, 69),
      frame(100, 69)
    ];
    const notes = segmentNotes(frames, { minDurationMs: 15, maxGapMs: 40 });
    expect(notes).toHaveLength(2);
  });

  it('averages cents and clarity over a note', () => {
    const frames = [
      frame(0, 69, 0.8, 10),
      frame(10, 69, 1.0, 20),
      frame(20, 69, 0.9, 30)
    ];
    const [note] = segmentNotes(frames, { minDurationMs: 10 });
    expect(note.cents).toBe(20);
    expect(note.clarity).toBeCloseTo(0.9, 5);
  });
});

describe('vibrato — INV-PITCH-015, INV-PITCH-016', () => {
  /** Frames every 10ms at a pitch that wobbles around a centre. */
  function wobble(
    centreMidi: number,
    depthCents: number,
    hz: number,
    ms: number,
    fromMs = 0
  ): PitchFrame[] {
    const frames: PitchFrame[] = [];
    for (let t = 0; t < ms; t += 10) {
      const cents = depthCents * Math.sin((2 * Math.PI * hz * t) / 1000);
      const pitch = centreMidi + cents / 100;
      const midi = Math.round(pitch);
      frames.push({
        timestampMs: fromMs + t,
        midi,
        cents: Math.round((pitch - midi) * 100),
        clarity: 0.95
      });
    }
    return frames;
  }

  it('reads a wide vibrato as one note, not a string of fragments', () => {
    // ±70 cents crosses the semitone boundary several times a second. This
    // used to end the note on every crossing, so the steadier and more
    // expressive the singing, the worse the reading.
    const notes = segmentNotes(wobble(60, 70, 6, 1500));
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].durationMs).toBeGreaterThan(1400);
  });

  it('puts the note at the centre of the wobble', () => {
    const [note] = segmentNotes(wobble(60, 60, 5, 1200));
    expect(Math.abs(note.cents)).toBeLessThan(15);
  });

  it('still hears a real step as a new note', () => {
    // A pitch that moves and stays moved is a new note; one that moves and
    // comes back is the same note wobbling.
    const notes = segmentNotes([
      ...wobble(60, 30, 5, 600),
      ...wobble(62, 30, 5, 600, 600)
    ]);
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.midi)).toEqual([60, 62]);
  });

  it('a narrower setting hears steps a wider one swallows', () => {
    // Which is the point of making it adjustable: voices differ more than
    // any one default covers.
    const frames = [...wobble(60, 20, 5, 400), ...wobble(60.7, 20, 5, 400, 400)];
    const wide = segmentNotes(frames, { vibratoSemitones: 1.2 });
    const narrow = segmentNotes(frames, { vibratoSemitones: 0.3 });
    expect(narrow.length).toBeGreaterThan(wide.length);
  });

  it('INV-PITCH-016: a scoop into a note does not drag its pitch', () => {
    // Singers slide into notes. An average is pulled by how far the approach
    // travelled; the middle value is not.
    const scoop: PitchFrame[] = [];
    for (let t = 0; t < 150; t += 10) {
      const pitch = 59.4 + (t / 150) * 0.6;
      const midi = Math.round(pitch);
      scoop.push({
        timestampMs: t,
        midi,
        cents: Math.round((pitch - midi) * 100),
        clarity: 0.9
      });
    }
    const [note] = segmentNotes([...scoop, ...wobble(60, 10, 5, 900, 150)]);
    expect(note.midi).toBe(60);
    expect(Math.abs(note.cents)).toBeLessThan(20);
  });

  it('never reports a deviation larger than half a semitone', () => {
    // A note is by definition nearer some semitone than half of one, and a
    // reading that says otherwise is describing the wrong note.
    for (const depth of [10, 40, 70, 95]) {
      for (const note of segmentNotes(wobble(60, depth, 6, 1000))) {
        expect(Math.abs(note.cents)).toBeLessThanOrEqual(50);
      }
    }
  });
});
