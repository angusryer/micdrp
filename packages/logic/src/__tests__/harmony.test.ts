import {
  chordTones,
  cycleQuality,
  harmonizeToGrid,
  QUALITY_CYCLE,
  revertSlot,
  scaleDegreeOf,
  setChord,
  transposeChromatic,
  transposeDiatonic,
  voiceChord,
  voiceProgression,
  type ChordSlot
} from '../harmony';
import { fitGrid } from '../quantize';
import type { KeyEstimate } from '../key';
import type { NoteEvent } from '../segmentation';

const C_MAJOR: KeyEstimate = {
  tonic: 0,
  tonicName: 'C',
  mode: 'major',
  confidence: 1
} as KeyEstimate;

const A_MINOR: KeyEstimate = {
  tonic: 9,
  tonicName: 'A',
  mode: 'minor',
  confidence: 1
} as KeyEstimate;

function note(startMs: number, durationMs: number, midi: number): NoteEvent {
  return {
    midi,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    cents: 0,
    clarity: 0.95,
    loudnessDb: null
  };
}

function slot(rootPc: number, quality: ChordSlot['quality'] = 'maj'): ChordSlot {
  return {
    bar: 1,
    startMs: 0,
    endMs: 2000,
    rootPc,
    quality,
    label: '',
    roman: '',
    confidence: 0.5,
    isEdited: false
  };
}

describe('chordTones', () => {
  it('builds the expected pitch classes', () => {
    expect(chordTones(0, 'maj')).toEqual([0, 4, 7]);
    expect(chordTones(9, 'min')).toEqual([9, 0, 4]);
    expect(chordTones(7, 'dom7')).toEqual([7, 11, 2, 5]);
  });

  it('wraps roots above B', () => {
    expect(chordTones(11, 'maj')).toEqual([11, 3, 6]);
  });
});

describe('harmonizeToGrid', () => {
  /** Two bars of C major then two of G major, at 120bpm in 4/4. */
  function twoChordMelody(): NoteEvent[] {
    const beat = 500;
    const notes: NoteEvent[] = [];
    // Bar 1: C E G C
    [60, 64, 67, 72].forEach((m, i) => notes.push(note(i * beat, beat, m)));
    // Bar 2: G B D G
    [67, 71, 74, 79].forEach((m, i) => notes.push(note(2000 + i * beat, beat, m)));
    return notes;
  }

  it('produces one slot per bar, aligned to the grid', () => {
    const notes = twoChordMelody();
    const grid = fitGrid(notes);
    const slots = harmonizeToGrid(notes, grid);
    expect(slots.length).toBeGreaterThanOrEqual(2);
    // Slots tile the timeline without gaps or overlaps.
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startMs).toBe(slots[i - 1].endMs);
    }
  });

  it('hears an arpeggiated C major bar as C', () => {
    const notes = twoChordMelody();
    const slots = harmonizeToGrid(notes, fitGrid(notes));
    expect(slots[0].rootPc).toBe(0);
    expect(slots[0].label).toBe('C');
  });

  it('can place two chords in a bar', () => {
    const notes = twoChordMelody();
    const grid = fitGrid(notes);
    const one = harmonizeToGrid(notes, grid, { chordsPerBar: 1 });
    const two = harmonizeToGrid(notes, grid, { chordsPerBar: 2 });
    expect(two.length).toBeGreaterThan(one.length);
    expect(two[0].endMs - two[0].startMs).toBeLessThan(
      one[0].endMs - one[0].startMs
    );
  });

  it('returns nothing without a melody or a grid', () => {
    const notes = twoChordMelody();
    expect(harmonizeToGrid([], fitGrid(notes))).toEqual([]);
    expect(harmonizeToGrid(notes, fitGrid([]))).toEqual([]);
  });

  it('labels slots both absolutely and by function', () => {
    const notes = twoChordMelody();
    const slots = harmonizeToGrid(notes, fitGrid(notes), { key: C_MAJOR });
    expect(slots[0].label).toBe('C');
    expect(slots[0].roman).toBe('I');
  });
});

describe('transposeDiatonic', () => {
  // Dragging up should move through the key, not slide the shape chromatically.
  it('steps to the next scale degree and takes that degree quality', () => {
    const up = transposeDiatonic(slot(0, 'maj'), C_MAJOR, 1);
    expect(up.rootPc).toBe(2);
    expect(up.quality).toBe('min');
    expect(up.label).toBe('Dm');
  });

  it('steps down through the key', () => {
    const down = transposeDiatonic(slot(0, 'maj'), C_MAJOR, -1);
    expect(down.rootPc).toBe(11);
    expect(down.quality).toBe('dim');
  });

  it('wraps around the octave', () => {
    const wrapped = transposeDiatonic(slot(0, 'maj'), C_MAJOR, 7);
    expect(wrapped.rootPc).toBe(0);
    expect(wrapped.quality).toBe('maj');
  });

  it('follows the minor scale in a minor key', () => {
    const up = transposeDiatonic(slot(9, 'min'), A_MINOR, 1);
    expect(up.rootPc).toBe(11);
    expect(up.quality).toBe('dim');
  });

  // A borrowed chord has no degree to step from, so it moves by semitone
  // instead of being silently snapped into the key.
  it('falls back to chromatic motion for a chord outside the key', () => {
    const outside = transposeDiatonic(slot(1, 'maj'), C_MAJOR, 1);
    expect(outside.rootPc).toBe(2);
    expect(outside.quality).toBe('maj');
  });

  it('marks the slot as edited', () => {
    expect(transposeDiatonic(slot(0), C_MAJOR, 1).isEdited).toBe(true);
  });

  it('is a no-op for zero degrees', () => {
    const original = slot(0);
    expect(transposeDiatonic(original, C_MAJOR, 0)).toBe(original);
  });
});

describe('transposeChromatic', () => {
  it('moves by semitone and keeps the shape', () => {
    const up = transposeChromatic(slot(0, 'min'), C_MAJOR, 1);
    expect(up.rootPc).toBe(1);
    expect(up.quality).toBe('min');
  });

  it('wraps below C', () => {
    expect(transposeChromatic(slot(0), C_MAJOR, -1).rootPc).toBe(11);
  });
});

describe('cycleQuality', () => {
  it('steps forward through the cycle keeping the root', () => {
    const next = cycleQuality(slot(5, 'maj'), C_MAJOR, 1);
    expect(next.rootPc).toBe(5);
    expect(next.quality).toBe(QUALITY_CYCLE[1]);
  });

  it('wraps at both ends', () => {
    const back = cycleQuality(slot(0, QUALITY_CYCLE[0]), C_MAJOR, -1);
    expect(back.quality).toBe(QUALITY_CYCLE[QUALITY_CYCLE.length - 1]);
  });

  it('relabels as the shape changes', () => {
    const minor = cycleQuality(slot(0, 'maj'), C_MAJOR, 1);
    expect(minor.label).toBe('Cm');
  });
});

describe('setChord and revertSlot', () => {
  it('sets a chord outright and marks it edited', () => {
    const set = setChord(slot(0), C_MAJOR, 7, 'dom7');
    expect(set.rootPc).toBe(7);
    expect(set.quality).toBe('dom7');
    expect(set.label).toBe('G7');
    expect(set.isEdited).toBe(true);
  });

  it('restores the inferred chord while keeping the slot in place', () => {
    const inferred = slot(0, 'maj');
    const edited = setChord({ ...inferred, startMs: 4000, endMs: 6000 }, C_MAJOR, 7, 'dom7');
    const reverted = revertSlot(edited, inferred);
    expect(reverted.rootPc).toBe(0);
    expect(reverted.isEdited).toBe(false);
    expect(reverted.startMs).toBe(4000);
    expect(reverted.endMs).toBe(6000);
  });
});

describe('scaleDegreeOf', () => {
  it('locates in-key roots and rejects outsiders', () => {
    expect(scaleDegreeOf(0, C_MAJOR)).toBe(0);
    expect(scaleDegreeOf(7, C_MAJOR)).toBe(4);
    expect(scaleDegreeOf(1, C_MAJOR)).toBe(-1);
  });
});

describe('voiceChord', () => {
  it('voices upward from the given bottom note', () => {
    const notes = voiceChord(0, 'maj', { bottomMidi: 48 });
    expect(notes).toEqual([48, 52, 55]);
  });

  // Successive chords should stay in one register rather than leaping an
  // octave whenever the root crosses B to C.
  it('keeps roots inside one octave of the bottom note', () => {
    for (let pc = 0; pc < 12; pc++) {
      const notes = voiceChord(pc, 'maj', { bottomMidi: 48 });
      expect(notes[0]).toBeGreaterThanOrEqual(48);
      expect(notes[0]).toBeLessThan(60);
    }
  });

  it('inverts by lifting the lowest tone an octave', () => {
    const root = voiceChord(0, 'maj', { bottomMidi: 48 });
    const first = voiceChord(0, 'maj', { bottomMidi: 48, inversion: 1 });
    expect(first).toEqual([52, 55, 60]);
    expect(first).not.toEqual(root);
  });

  it('always returns pitches in ascending order', () => {
    for (const quality of QUALITY_CYCLE) {
      for (let inversion = 0; inversion < 4; inversion++) {
        const notes = voiceChord(3, quality, { inversion });
        const sorted = notes.slice().sort((a, b) => a - b);
        expect(notes).toEqual(sorted);
      }
    }
  });
});

describe('voiceProgression', () => {
  it('carries each slot span onto its playable chord', () => {
    const slots = [slot(0, 'maj'), { ...slot(7, 'maj'), startMs: 2000, endMs: 4000 }];
    const played = voiceProgression(slots);
    expect(played).toHaveLength(2);
    expect(played[0].startMs).toBe(0);
    expect(played[1].endMs).toBe(4000);
    expect(played[1].midi.length).toBe(3);
  });
});
