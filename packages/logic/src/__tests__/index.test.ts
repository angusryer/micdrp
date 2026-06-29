import * as logic from '../index';

describe('logic public API', () => {
  it('exposes pitch detection and note helpers', () => {
    expect(typeof logic.detectPitch).toBe('function');
    expect(typeof logic.frequencyToNote).toBe('function');
    expect(typeof logic.frequencyToMidi).toBe('function');
    expect(typeof logic.midiToFrequency).toBe('function');
  });
});
