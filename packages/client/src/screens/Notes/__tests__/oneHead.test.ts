/**
 * One head, running or waiting (INV-TPORT-007).
 *
 * Two cues meant two answers: the screen kept its own and the transport
 * kept another, so a rewind on a stopped take moved one while every
 * display drew the other. The transport holds the only one now, and a
 * seek goes through it.
 */
import { createTransport, type TransportEngine } from '../../../audio/transportStore';

const engine = (): TransportEngine & { starts: number[] } => {
  const e = {
    starts: [] as number[],
    start(fromMs: number) {
      e.starts.push(fromMs);
      return Promise.resolve(25000);
    },
    silence: () => undefined,
    reachedMs: () => 0
  };
  return e;
};

describe('the cue everything reads', () => {
  it('moves when a stopped take is seeked', async () => {
    const t = createTransport(engine());
    await t.stop();
    await t.seek(7000);
    expect(t.snapshot().cueMs).toBe(7000);
  });

  it('is where the next press starts from', async () => {
    const e = engine();
    const t = createTransport(e);
    await t.seek(7000);
    await t.play();
    expect(e.starts).toEqual([7000]);
  });

  it('is where a rewind leaves it', async () => {
    // Rewind is a seek backwards from where the head is, and the head is
    // the cue whenever nothing is sounding.
    const t = createTransport(engine());
    await t.seek(12000);
    await t.seek(Math.max(0, t.snapshot().cueMs - 5000));
    expect(t.snapshot().cueMs).toBe(7000);
  });

  it('never goes before the start of the take', async () => {
    const t = createTransport(engine());
    await t.seek(-500);
    expect(t.snapshot().cueMs).toBe(0);
  });
});
