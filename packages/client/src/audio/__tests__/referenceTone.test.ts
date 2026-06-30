/**
 * Unit tests for the reference-tone player, driven through an injected fake
 * AudioContext (no native dependency). We assert that each target note schedules
 * one oscillator at the right frequency/time, and that stop() tears the graph
 * down.
 */
import { midiToFrequency, type TargetNote } from 'logic';

import {
  createReferenceTonePlayer,
  type AudioContextLike
} from '../referenceTone';

interface ScheduledOsc {
  freq: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
}

function makeFakeContext(): {
  ctx: AudioContextLike;
  oscs: ScheduledOsc[];
  closed: () => boolean;
} {
  const oscs: ScheduledOsc[] = [];
  let isClosed = false;
  const param = () => ({
    value: 0,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn()
  });
  const ctx: AudioContextLike = {
    currentTime: 10,
    destination: {},
    createOscillator: () => {
      const rec: ScheduledOsc = { freq: null, startedAt: null, stoppedAt: null };
      oscs.push(rec);
      const freq = param();
      const realSet = freq.setValueAtTime;
      freq.setValueAtTime = jest.fn((v: number, t: number) => {
        rec.freq = v;
        realSet(v, t);
      });
      return {
        type: 'sine',
        frequency: freq,
        connect: jest.fn(),
        start: jest.fn((t: number) => {
          rec.startedAt = t;
        }),
        stop: jest.fn((t: number) => {
          rec.stoppedAt = t;
        })
      };
    },
    createGain: () => ({ gain: param(), connect: jest.fn() }),
    close: () => {
      isClosed = true;
    }
  };
  return { ctx, oscs, closed: () => isClosed };
}

const MELODY: TargetNote[] = [
  { midi: 60, startMs: 0, endMs: 500 },
  { midi: 64, startMs: 500, endMs: 1000 }
];

describe('createReferenceTonePlayer', () => {
  it('schedules one oscillator per note at the right frequency and time', () => {
    const fake = makeFakeContext();
    const player = createReferenceTonePlayer({ createContext: () => fake.ctx });

    player.play(MELODY);

    expect(fake.oscs).toHaveLength(2);
    expect(fake.oscs[0].freq).toBeCloseTo(midiToFrequency(60), 5);
    expect(fake.oscs[1].freq).toBeCloseTo(midiToFrequency(64), 5);
    // currentTime is 10; note 2 starts 0.5s in.
    expect(fake.oscs[0].startedAt).toBeCloseTo(10);
    expect(fake.oscs[1].startedAt).toBeCloseTo(10.5);
    expect(fake.oscs[1].stoppedAt).toBeCloseTo(11);
  });

  it('is an inert no-op when the audio package is unavailable', () => {
    const player = createReferenceTonePlayer({ createContext: () => null });
    expect(() => player.play(MELODY)).not.toThrow();
  });

  it('does nothing for an empty melody', () => {
    const fake = makeFakeContext();
    const player = createReferenceTonePlayer({ createContext: () => fake.ctx });
    player.play([]);
    expect(fake.oscs).toHaveLength(0);
  });

  it('stop() closes the context and is safe to call twice', () => {
    const fake = makeFakeContext();
    const player = createReferenceTonePlayer({ createContext: () => fake.ctx });
    player.play(MELODY);
    player.stop();
    expect(fake.closed()).toBe(true);
    expect(() => player.stop()).not.toThrow();
  });
});
