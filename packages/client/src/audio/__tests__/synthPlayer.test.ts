/**
 * synthPlayer — one native engine behind many players, and the fallback that
 * keeps old binaries sounding (INV-NOTES-030).
 */
import type { Spec } from '../../specs/NativeSynth';
import type { AudioContextLike } from '../referenceTone';

type SynthPlayerModule = typeof import('../synthPlayer');

const makeSynth = () => ({
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  nowMs: jest.fn().mockReturnValue(1000),
  setBusLevel: jest.fn(),
  schedule: jest.fn(),
  clearBus: jest.fn(),
  clearAll: jest.fn()
});

/** Load a fresh module registry with the native module present or absent. */
function load(native: Partial<Spec> | null): SynthPlayerModule {
  let mod: SynthPlayerModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('../../specs/NativeSynth', () => ({
      __esModule: true,
      default: native
    }));
    mod = require('../synthPlayer') as SynthPlayerModule;
  });
  return mod!;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('without the native module (INV-NOTES-030)', () => {
  it('falls back to the per-context player instead of going silent', () => {
    const { createTonePlayer, SynthBus } = load(null);
    const oscillators: unknown[] = [];
    const ctx: AudioContextLike = {
      currentTime: 0,
      destination: {},
      createOscillator: () => {
        const osc = {
          type: 'sine',
          frequency: { value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        };
        oscillators.push(osc);
        return osc;
      },
      createGain: () => ({
        gain: { value: 0, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
        connect: jest.fn()
      }),
      close: jest.fn()
    };

    const player = createTonePlayer(SynthBus.Melody, { createContext: () => ctx });
    player.play([{ midi: 69, startMs: 0, endMs: 500 }]);
    expect(oscillators).toHaveLength(1);
  });
});

describe('with the native module', () => {
  it('anchors the schedule to the engine clock, on the given bus', async () => {
    const synth = makeSynth();
    const { createTonePlayer, SynthBus } = load(synth);

    const player = createTonePlayer(SynthBus.Melody);
    player.play([{ midi: 69, startMs: 0, endMs: 500 }]);
    await flush();

    expect(synth.start).toHaveBeenCalledTimes(1);
    // nowMs (1000) plus the 50ms lead that keeps the first note from being late.
    expect(synth.schedule).toHaveBeenCalledWith([
      { bus: 1, frequencyHz: 440, startMs: 1050, endMs: 1550 }
    ]);
  });

  it('keeps peakGain meaning what it meant against the old players', async () => {
    const synth = makeSynth();
    const { createTonePlayer, SynthBus } = load(synth);

    // Old effective amplitude was level * peakGain; the bus level preserves it
    // relative to the old default peak of 0.2.
    const player = createTonePlayer(SynthBus.Chords, { peakGain: 0.06 });
    player.play([{ midi: 60, startMs: 0, endMs: 100 }]);
    await flush();
    expect(synth.setBusLevel).toHaveBeenLastCalledWith(2, expect.closeTo(0.3));

    player.setLevel(0.5);
    expect(synth.setBusLevel).toHaveBeenLastCalledWith(2, expect.closeTo(0.15));
  });

  it('stops its own bus, and the engine only when the last player leaves', async () => {
    const synth = makeSynth();
    const { createTonePlayer, SynthBus } = load(synth);

    const melody = createTonePlayer(SynthBus.Melody);
    const chords = createTonePlayer(SynthBus.Chords);
    melody.play([{ midi: 69, startMs: 0, endMs: 500 }]);
    chords.play([{ midi: 60, startMs: 0, endMs: 500 }]);
    await flush();

    melody.stop();
    expect(synth.clearBus).toHaveBeenLastCalledWith(1);
    expect(synth.stop).not.toHaveBeenCalled();

    chords.stop();
    expect(synth.clearBus).toHaveBeenLastCalledWith(2);
    expect(synth.stop).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing when stopped while the engine was still starting', async () => {
    const synth = makeSynth();
    let startEngine: () => void = () => {};
    synth.start.mockReturnValue(new Promise<void>((r) => (startEngine = r)));
    const { createTonePlayer, SynthBus } = load(synth);

    const player = createTonePlayer(SynthBus.Audition);
    player.play([{ midi: 69, startMs: 0, endMs: 500 }]);
    player.stop();
    startEngine();
    await flush();

    expect(synth.schedule).not.toHaveBeenCalled();
    expect(synth.stop).toHaveBeenCalledTimes(1);
  });

  it('treats an empty melody as stop, like the old player did', async () => {
    const synth = makeSynth();
    const { createTonePlayer, SynthBus } = load(synth);

    const player = createTonePlayer(SynthBus.Melody);
    player.play([{ midi: 69, startMs: 0, endMs: 500 }]);
    await flush();
    player.play([]);

    expect(synth.clearBus).toHaveBeenLastCalledWith(1);
    expect(synth.stop).toHaveBeenCalledTimes(1);
  });
});
