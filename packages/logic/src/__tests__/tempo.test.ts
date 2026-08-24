import { estimateTempo, MIN_BPM, MAX_BPM } from '../tempo';
import type { NoteEvent } from '../segmentation';

function note(startMs: number, durationMs = 200): NoteEvent {
  return {
    midi: 60,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    cents: 0,
    clarity: 0.95, loudnessDb: null
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
    expect(estimateTempo([])).toEqual({ bpm: 0, confidence: 0, offsetMs: 0 });
    expect(estimateTempo([note(0)])).toEqual({ bpm: 0, confidence: 0, offsetMs: 0 });
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

/**
 * A grid pinned to t = 0 was the single biggest source of wrong tempi. Nobody
 * starts singing at t = 0 — they tap record, breathe, and begin — and a take
 * that started half a beat late used to fit the half-period grid better than
 * the true one, reporting double tempo with high confidence.
 */
describe('estimateTempo — grid phase', () => {
  /** The same performance, begun at different moments. */
  function offsetGrid(bpm: number, count: number, startMs: number): NoteEvent[] {
    const period = 60000 / bpm;
    const notes: NoteEvent[] = [];
    for (let i = 0; i < count; i++) {
      notes.push(note(Math.round(startMs + i * period)));
    }
    return notes;
  }

  it('reads the same tempo no matter when the singer came in', () => {
    for (const startMs of [0, 120, 250, 333, 500]) {
      const result = estimateTempo(offsetGrid(90, 16, startMs));
      expect(result.bpm).toBeGreaterThanOrEqual(88);
      expect(result.bpm).toBeLessThanOrEqual(92);
    }
  });

  it('reports where the first beat actually falls', () => {
    expect(estimateTempo(offsetGrid(90, 16, 0)).offsetMs).toBeLessThan(12);
    expect(estimateTempo(offsetGrid(90, 16, 250)).offsetMs).toBeGreaterThan(238);
    expect(estimateTempo(offsetGrid(90, 16, 250)).offsetMs).toBeLessThan(262);
  });

  // The specific failure: a half-beat late start used to report 180.
  it('does not double the tempo for a half-beat late start', () => {
    const result = estimateTempo(offsetGrid(90, 16, 333));
    expect(result.bpm).toBeLessThan(140);
  });

  // A period error does not stay small — it accumulates as drift, so a grid
  // that is right at the start of a phrase is a sixteenth out by the end.
  it('keeps the grid aligned across a long take', () => {
    const notes = offsetGrid(90, 45, 250); // 30 seconds
    const result = estimateTempo(notes);
    const beatMs = 60000 / result.bpm;
    const last = notes[notes.length - 1].startMs;
    const drift = Math.abs(
      last - (result.offsetMs + Math.round((last - result.offsetMs) / beatMs) * beatMs)
    );
    expect(drift).toBeLessThan(20);
  });
});

describe('estimateTempo — octave errors', () => {
  it('hears eighth notes at 90bpm as 90, not 180', () => {
    const result = estimateTempo(grid(180, 16));
    expect(result.bpm).toBeGreaterThanOrEqual(85);
    expect(result.bpm).toBeLessThanOrEqual(95);
  });

  it('hears sixteenths at 100bpm as 100, not 400', () => {
    const result = estimateTempo(grid(400, 24));
    expect(result.bpm).toBeGreaterThanOrEqual(95);
    expect(result.bpm).toBeLessThanOrEqual(105);
  });

  // Only multiples of the observed pulse are considered, never divisions of
  // it. A melody with one onset every 1.3s gives no evidence for a beat in
  // between, and inventing one to reach a nicer-looking bpm would be a guess
  // dressed up as a measurement.
  it('does not invent a subdivision it has no evidence for', () => {
    const result = estimateTempo(grid(45, 12));
    expect(result.bpm).toBeGreaterThanOrEqual(44);
    expect(result.bpm).toBeLessThanOrEqual(46);
  });
});

/**
 * Confidence is the best of ~2000 candidate periods, and the maximum of any
 * statistic over many candidates is inflated: eight onsets placed at random
 * still cluster at about 0.79 on some period. Unless that chance level is
 * subtracted, a shapeless take claims to be firmly in tempo.
 */
describe('estimateTempo — confidence', () => {
  function randomOnsets(count: number, seed: number): NoteEvent[] {
    let state = seed;
    const rnd = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    const notes: NoteEvent[] = [];
    let t = 0;
    for (let i = 0; i < count; i++) {
      t += 150 + rnd() * 900;
      notes.push(note(Math.round(t)));
    }
    return notes;
  }

  it('is near 1 for a take that is genuinely in tempo', () => {
    expect(estimateTempo(grid(100, 16)).confidence).toBeGreaterThan(0.9);
  });

  it('stays low for onsets with no pulse behind them', () => {
    for (const seed of [1, 7, 99, 12345]) {
      expect(estimateTempo(randomOnsets(16, seed)).confidence).toBeLessThan(0.5);
    }
  });

  it('separates a real pulse from chance by a wide margin', () => {
    const real = estimateTempo(grid(100, 16)).confidence;
    const chance = estimateTempo(randomOnsets(16, 4242)).confidence;
    expect(real - chance).toBeGreaterThan(0.4);
  });
});
