import { fitGrid, quantize, quantizeNotes } from '../quantize';
import type { NoteEvent } from '../segmentation';

function note(startMs: number, durationMs = 400, midi = 60): NoteEvent {
  return {
    midi,
    startMs: Math.round(startMs),
    endMs: Math.round(startMs + durationMs),
    durationMs: Math.round(durationMs),
    cents: 0,
    clarity: 0.95, loudnessDb: null
  };
}

/** A melody of quarter notes at `bpm`, optionally starting late. */
function quarters(bpm: number, count: number, startMs = 0): NoteEvent[] {
  const beat = 60000 / bpm;
  const notes: NoteEvent[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(note(startMs + i * beat, beat * 0.9));
  }
  return notes;
}

/**
 * A melody with a note on every downbeat and shorter notes between, which is
 * what gives metre detection something to find.
 */
function withDownbeats(bpm: number, beatsPerBar: number, bars: number): NoteEvent[] {
  const beat = 60000 / bpm;
  const notes: NoteEvent[] = [];
  for (let b = 0; b < bars; b++) {
    const barStart = b * beatsPerBar * beat;
    // A long note on the downbeat, then short ones on the remaining beats.
    notes.push(note(barStart, beat * 0.95, 60));
    for (let i = 1; i < beatsPerBar; i++) {
      notes.push(note(barStart + i * beat, beat * 0.4, 62));
    }
  }
  return notes;
}

describe('fitGrid', () => {
  it('recovers tempo and time signature from an even 4/4 melody', () => {
    const grid = fitGrid(withDownbeats(100, 4, 6));
    expect(grid.bpm).toBeGreaterThanOrEqual(96);
    expect(grid.bpm).toBeLessThanOrEqual(104);
    expect(grid.timeSignature).toBe('4/4');
    expect(grid.isCompound).toBe(false);
  });

  it('recognises a waltz as 3/4 rather than forcing 4/4', () => {
    const grid = fitGrid(withDownbeats(120, 3, 8));
    expect(grid.beatsPerBar).toBe(3);
    expect(grid.timeSignature).toBe('3/4');
  });

  it('returns a neutral grid when there is nothing to fit', () => {
    const grid = fitGrid([]);
    expect(grid.bpm).toBe(0);
    expect(grid.confidence).toBe(0);
    expect(grid.timeSignature).toBe('4/4');
  });

  // The old pipeline reported 6/8 whenever tempo came out above 180, which
  // meant an octave error in the tempo silently became a wrong time signature.
  it('does not read a fast simple melody as compound', () => {
    const grid = fitGrid(quarters(180, 24));
    expect(grid.isCompound).toBe(false);
    expect(grid.timeSignature).toBe('4/4');
  });
});

describe('quantizeNotes', () => {
  it('leaves the performance untouched while adding grid values', () => {
    const performed = quarters(100, 8, 250);
    const grid = fitGrid(performed);
    const quantized = quantizeNotes(performed, grid);

    for (let i = 0; i < performed.length; i++) {
      expect(quantized[i].startMs).toBe(performed[i].startMs);
      expect(quantized[i].endMs).toBe(performed[i].endMs);
      expect(quantized[i].durationMs).toBe(performed[i].durationMs);
    }
    expect(quantized[0].gridStartMs).toBeDefined();
  });

  it('snaps a slightly loose take onto clean quarter notes', () => {
    const beat = 600; // 100 bpm
    const drifts = [0, 18, -22, 31, -14, 25, -9, 12];
    const performed = drifts.map((d, i) => note(i * beat + d, beat * 0.9));
    const result = quantize(performed);

    for (const n of result.notes) {
      expect(n.durationLabel).toBe('quarter');
      expect(Math.abs(n.deviationMs)).toBeLessThanOrEqual(40);
    }
  });

  it('reports where the singer sat against the beat', () => {
    const beat = 600;
    // Consistently 40ms behind — a real and musically meaningful habit.
    const performed = [0, 1, 2, 3, 4, 5].map(i => note(i * beat + 40, beat * 0.9));
    const result = quantize(performed);
    const deviations = result.notes.map(n => n.deviationMs);
    // Every note is displaced the same way, so the fitted grid absorbs the lag
    // rather than each note reporting it — the grid IS where they sang.
    for (const d of deviations) {
      expect(Math.abs(d)).toBeLessThan(20);
    }
    expect(result.grid.offsetMs % 600).toBeGreaterThan(20);
  });

  it('numbers bars and beats from the fitted bar line', () => {
    const result = quantize(withDownbeats(120, 4, 4));
    expect(result.notes[0].bar).toBe(1);
    expect(result.notes[0].beat).toBeCloseTo(1, 1);
    expect(result.notes[4].bar).toBe(2);
    expect(result.notes[4].beat).toBeCloseTo(1, 1);
  });

  it('never collapses a note to zero length', () => {
    const beat = 600;
    const performed = [note(0, 5), note(beat, 5), note(2 * beat, 5)];
    const result = quantize(performed);
    for (const n of result.notes) {
      expect(n.gridDurationMs).toBeGreaterThan(0);
      expect(n.durationBeats).toBeGreaterThan(0);
    }
  });

  it('notates eighths as eighths, not as quarters', () => {
    const beat = 600;
    const performed: NoteEvent[] = [];
    for (let i = 0; i < 12; i++) {
      performed.push(note((i * beat) / 2, beat * 0.4));
    }
    const result = quantize(performed);
    for (const n of result.notes) {
      expect(n.durationBeats).toBeCloseTo(0.5, 2);
      expect(n.durationLabel).toBe('eighth');
    }
  });

  it('produces nothing when there is no grid to work against', () => {
    expect(quantizeNotes([note(0)], fitGrid([]))).toEqual([]);
  });
});

describe('quantize — deviation reporting', () => {
  // The grid is fitted to these very onsets, so it absorbs a consistent lag
  // instead of reporting it. Deviation says how much snapping happened, not
  // how good the singer's time was, and the tests must not imply otherwise.
  it('reports near-zero deviation for a take that is already on a grid', () => {
    const result = quantize(quarters(100, 8));
    expect(result.medianDeviationMs).toBeLessThan(10);
  });

  it('still fits a grid to a take that wanders', () => {
    const beat = 600;
    const drifts = [0, 140, -120, 95, -160, 130, -90, 150];
    const result = quantize(drifts.map((d, i) => note(i * beat + d, beat * 0.8)));
    expect(result.grid.bpm).toBeGreaterThan(0);
    expect(result.notes).toHaveLength(drifts.length);
  });
});

describe('INV-PITCH-022: a count overrules the inference', () => {
  /** "ONE two three ONE two three" at 100bpm, stressed on each bar. */
  const waltzCount = (bpm: number, beats: number): NoteEvent[] => {
    const beatMs = 60000 / bpm;
    return Array.from({ length: beats }, (_, i) => ({
      ...note(i * beatMs, beatMs * 0.4),
      loudnessDb: i % 3 === 0 ? -9 : -17
    }));
  };

  it('takes the tempo from the count rather than fitting one', () => {
    const grid = fitGrid(waltzCount(100, 7));
    expect(grid.bpm).toBe(100);
  });

  it('takes the metre from where the stresses fell', () => {
    const grid = fitGrid(waltzCount(100, 7));
    expect(grid.beatsPerBar).toBe(3);
    expect(grid.timeSignature).toBe('3/4');
    expect(grid.meterIsStated).toBe(true);
  });

  it('puts beat one where the counting started, not where a fit lands it', () => {
    // Somebody counting put beat one where they put it, and that is not a
    // thing to re-derive from the audio afterwards.
    const late = waltzCount(100, 7).map((n) => ({
      ...n,
      startMs: n.startMs + 250,
      endMs: n.endMs + 250
    }));
    expect(fitGrid(late).offsetMs).toBe(250);
  });

  it('leaves a take with no count exactly as it was', () => {
    // The whole risk of this reading is hijacking music that was never
    // counted, so the fitter's own answer has to survive untouched.
    const plain = withDownbeats(120, 3, 8);
    expect(fitGrid(plain).beatsPerBar).toBe(3);
    expect(fitGrid(plain).timeSignature).toBe('3/4');
  });
});
