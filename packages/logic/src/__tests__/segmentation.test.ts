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
