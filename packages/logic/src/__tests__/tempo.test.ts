import { estimateTempo, MIN_BPM, MAX_BPM } from '../tempo';
import type { NoteEvent } from '../segmentation';

function note(startMs: number, durationMs = 200): NoteEvent {
  return {
    midi: 60,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    cents: 0,
    clarity: 0.95
  };
}

/** Build an evenly spaced onset grid at the given bpm. */
function grid(bpm: number, count: number): NoteEvent[] {
  const period = 60000 / bpm;
  const notes: NoteEvent[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(note(Math.round(i * period)));
  }
  return notes;
}

describe('estimateTempo', () => {
  it('resolves an even 120bpm onset grid to ~120', () => {
    const result = estimateTempo(grid(120, 16));
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('resolves a 90bpm grid to ~90', () => {
    const result = estimateTempo(grid(90, 16));
    expect(result.bpm).toBeGreaterThanOrEqual(88);
    expect(result.bpm).toBeLessThanOrEqual(92);
  });

  it('handles a grid with a missing beat (syncopation)', () => {
    // 100 bpm grid (600ms period) with one onset dropped.
    const notes = grid(100, 12);
    notes.splice(5, 1);
    const result = estimateTempo(notes);
    expect(result.bpm).toBeGreaterThanOrEqual(96);
    expect(result.bpm).toBeLessThanOrEqual(104);
  });

  it('clamps an absurdly fast onset stream to the max vocal bpm', () => {
    // 50ms spacing => 1200 bpm raw; must clamp to 240.
    const notes: NoteEvent[] = [];
    for (let i = 0; i < 20; i++) {
      notes.push(note(i * 50));
    }
    const result = estimateTempo(notes);
    expect(result.bpm).toBeLessThanOrEqual(MAX_BPM);
  });

  it('clamps an absurdly slow onset stream to the min vocal bpm', () => {
    // 3000ms spacing => 20 bpm raw; period exceeds the band, folded by /2 etc.,
    // but the clamp guarantees a floor.
    const notes: NoteEvent[] = [];
    for (let i = 0; i < 6; i++) {
      notes.push(note(i * 3000));
    }
    const result = estimateTempo(notes);
    expect(result.bpm).toBeGreaterThanOrEqual(MIN_BPM);
    expect(result.bpm).toBeLessThanOrEqual(MAX_BPM);
  });

  it('returns zero bpm/confidence for fewer than two onsets', () => {
    expect(estimateTempo([])).toEqual({ bpm: 0, confidence: 0 });
    expect(estimateTempo([note(0)])).toEqual({ bpm: 0, confidence: 0 });
  });

  it('tolerates unsorted input', () => {
    const ordered = grid(120, 8);
    const shuffled = [ordered[3], ordered[0], ordered[6], ordered[1], ordered[4], ordered[2], ordered[7], ordered[5]];
    const result = estimateTempo(shuffled);
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
  });

  it('produces confidence within [0, 1]', () => {
    const result = estimateTempo(grid(75, 10));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
