import { detectPitch } from '../mpm';

const SAMPLE_RATE = 44100;

function sine(frequencyHz: number, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin((2 * Math.PI * frequencyHz * i) / SAMPLE_RATE);
  }
  return out;
}

describe('detectPitch (MPM)', () => {
  [110, 220, 440, 660].forEach((freq) => {
    it(`detects a ${freq}Hz sine within 1%`, () => {
      const { frequency, clarity } = detectPitch(sine(freq, 2048), SAMPLE_RATE);
      expect(frequency).not.toBeNull();
      expect(Math.abs((frequency as number) - freq) / freq).toBeLessThan(0.01);
      expect(clarity).toBeGreaterThan(0.85);
    });
  });

  it('returns null for silence', () => {
    const { frequency } = detectPitch(new Float32Array(2048), SAMPLE_RATE);
    expect(frequency).toBeNull();
  });

  it('honours the maxFrequency bound', () => {
    const { frequency } = detectPitch(sine(440, 2048), SAMPLE_RATE, {
      maxFrequency: 200
    });
    expect(frequency).toBeNull();
  });

  it('honours the minFrequency bound', () => {
    const { frequency } = detectPitch(sine(110, 2048), SAMPLE_RATE, {
      minFrequency: 200
    });
    expect(frequency).toBeNull();
  });
});
