/**
 * ACC-TPORT-030 / ACC-TPORT-031 — who keeps the engine alive, and what a
 * restart invalidates.
 *
 * The tone players counted holders and the last one out stopped the engine.
 * The take went through a different door and never counted — so muting the
 * transcription, the only holder, tore the engine down underneath a take
 * that was playing through it.
 *
 * And stopping the engine frees every resident slot. The take remembered
 * which recording was in its slot and skipped the decode when it matched, so
 * every press after a teardown scheduled a slot holding nothing: silence
 * that survived toggling the track back on, because the cache was certain
 * and wrong.
 */
jest.mock('../../specs/NativeSynth', () => ({
  __esModule: true,
  default: (require('../../screens/Notes/__fixtures__/synthDouble') as typeof import('../../screens/Notes/__fixtures__/synthDouble'))
    .synthDouble
}));

import {
  resetSynthDouble,
  synthDouble as synth
} from '../../screens/Notes/__fixtures__/synthDouble';
import { acquireEngine, engineGeneration, releaseEngine } from '../synthPlayer';
import { startEngine, stopHoldingEngine } from '../engineSamples';

beforeEach(() => resetSynthDouble());

/** Let go of anything this test left holding, so the next starts clean. */
const releaseAll = (times: number) => {
  for (let i = 0; i < times; i += 1) {
    releaseEngine();
  }
};

describe('ACC-TPORT-030: what keeps the engine open', () => {
  it('stays running while a take still holds it', async () => {
    // The take holds through the same door as everything else now.
    await startEngine();
    await acquireEngine(); // a synthesized voice starts

    // That voice stops — muting the transcription is exactly this.
    releaseEngine();
    expect(synth.stop).not.toHaveBeenCalled();

    stopHoldingEngine();
    expect(synth.stop).toHaveBeenCalled();
  });

  it('stops once nothing at all is holding it', async () => {
    await acquireEngine();
    releaseEngine();
    expect(synth.stop).toHaveBeenCalled();
  });

  it('starts once however many hold it', async () => {
    await acquireEngine();
    await acquireEngine();
    expect(synth.start).toHaveBeenCalledTimes(1);
    releaseAll(2);
  });
});

describe('ACC-TPORT-031: what a restart invalidates', () => {
  it('counts a cold start, so a cache can tell it apart', async () => {
    await acquireEngine();
    const first = engineGeneration();
    // Held open: no new run, so nothing was freed.
    await acquireEngine();
    expect(engineGeneration()).toBe(first);

    releaseAll(2);
    await acquireEngine();
    // Torn down and started again, which freed every slot.
    expect(engineGeneration()).toBeGreaterThan(first);
    releaseEngine();
  });
});
