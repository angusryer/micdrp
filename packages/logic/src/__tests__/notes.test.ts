import {
  frequencyToMidi,
  frequencyToNote,
  midiToFrequency
} from '../notes';

describe('note conversions', () => {
  it('maps A4 (440Hz) to MIDI 69 / A4', () => {
    expect(Math.round(frequencyToMidi(440))).toBe(69);
    const note = frequencyToNote(440);
    expect(note.midi).toBe(69);
    expect(note.name).toBe('A');
    expect(note.octave).toBe(4);
    expect(Math.abs(note.cents)).toBeLessThanOrEqual(1);
  });

  it('maps middle C (~261.63Hz) to MIDI 60 / C4', () => {
    const note = frequencyToNote(261.6256);
    expect(note.midi).toBe(60);
    expect(note.name).toBe('C');
    expect(note.octave).toBe(4);
  });

  it('round-trips midi <-> frequency', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 2);
  });

  it('reports positive cents for a slightly sharp A4', () => {
    const note = frequencyToNote(443);
    expect(note.midi).toBe(69);
    expect(note.cents).toBeGreaterThan(0);
  });

  it('reports negative cents for a slightly flat A4', () => {
    const note = frequencyToNote(437);
    expect(note.midi).toBe(69);
    expect(note.cents).toBeLessThan(0);
  });
});
