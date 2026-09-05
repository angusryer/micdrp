/**
 * Reading the engine rather than inferring (INV-TPORT-010, INV-TPORT-014).
 *
 * The fallback is the part that matters here. A bundle arriving before
 * its binary is the normal case in this app, and reading a method that
 * is not there is a crash on somebody's phone.
 */
import {
  beginEngineRun,
  endEngineRun,
  engineReportsTransport,
  engineRun
} from '../engineTransport';

/** The engine, as a binary of whatever vintage the case needs. */
const synth: Record<string, unknown> = {};
jest.mock('../../specs/NativeSynth', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  get default() {
    return synth;
  }
}));

afterEach(() => {
  for (const key of Object.keys(synth)) {
    delete synth[key];
  }
});

describe('asking the engine where it is', () => {
  it('reads the run it reports', () => {
    synth.transportReport = () => ({
      positionMs: 8400,
      running: true,
      generation: 3,
      ended: 0
    });
    expect(engineRun()).toEqual({
      positionMs: 8400,
      running: true,
      generation: 3,
      ended: 0,
      // A binary that reports a run but not its underruns has not measured
      // them, and unmeasured reads as none rather than as unknown here —
      // the count only ever rises, so zero is the honest floor.
      underruns: 0
    });
  });

  it('INV-TPORT-014: says nothing where the binary is older than this bundle', () => {
    delete synth.transportReport;
    expect(engineReportsTransport()).toBe(false);
    // Null means "work it out the old way", not "nothing is playing".
    expect(engineRun()).toBeNull();
  });

  it('treats a binary that has the name but not the behaviour as unable', () => {
    synth.transportReport = () => {
      throw new Error('not implemented');
    };
    expect(engineRun()).toBeNull();
  });

  it('does not take a missing field for a measured zero', () => {
    synth.transportReport = () => ({}) as never;
    expect(engineRun()?.running).toBe(false);
  });

  it('starting and ending a run are no-ops on an older binary', () => {
    delete synth.startTransport;
    delete synth.stopTransport;
    expect(() => beginEngineRun(0, 100, 200)).not.toThrow();
    expect(() => endEngineRun()).not.toThrow();
  });

  it('tells the engine a run began, separately from the sound', () => {
    // A run is time passing; a voice is a sound. Muting must not stop
    // the clock (INV-TPORT-013).
    const calls: number[][] = [];
    synth.startTransport = (...args: number[]) => calls.push(args);
    beginEngineRun(2000, 5000, 30000);
    expect(calls).toEqual([[2000, 5000, 30000]]);
  });
});
