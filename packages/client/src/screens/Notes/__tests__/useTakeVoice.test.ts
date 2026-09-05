/**
 * INV-NOTES-133 — the take sounds through the one engine, on the one clock.
 *
 * Everything the app synthesizes already ran on one sample counter. The take
 * did not, so every alignment between them was an estimate across two clocks
 * that drift rather than differ by a constant. Here it is scheduled by the
 * same call, on the same clock, at the same bus levels as a tone.
 *
 * `renderHook` is async in this setup — await it.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

/**
 * Asked of the registry rather than written down: a bus is a position in the
 * track list, so inserting a track shifts every number after it
 * (INV-NOTES-121).
 */
const TAKE_BUS = trackBus('take');

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { useTakeVoice } from '../useTakeVoice';
import { trackBus } from '../trackRegistry';
import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';

beforeEach(resetSynthDouble);

const uri = () => Promise.resolve('file:///take.m4a');

describe('playing a take through the engine', () => {
  it('decodes it once and schedules it on the engine clock', async () => {
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      await result.current.play();
    });

    expect(synth.loadSample).toHaveBeenCalledWith(0, 'file:///take.m4a');
    const [[booked]] = synth.scheduleSamples.mock.calls as [
      [{ bus: number; slot: number; fromMs: number; startMs: number; endMs: number }[]]
    ];
    // Booked ahead of the engine's own now, which is what everything else is
    // booked against. The double's clock reads zero, so the lead is all of it.
    expect(booked[0].bus).toBe(TAKE_BUS);
    expect(booked[0].startMs).toBeGreaterThan(0);
    expect(booked[0].endMs - booked[0].startMs).toBe(60_000);
    await waitFor(() => expect(result.current.state).toBe('playing'));
  });

  it('does not decode the same take twice', async () => {
    // The decode is the one slow step, and it belongs to the take rather than
    // to the press.
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      await result.current.play();
    });
    await act(async () => {
      await result.current.stop();
    });
    await act(async () => {
      await result.current.play();
    });

    expect(synth.loadSample).toHaveBeenCalledTimes(1);
    expect(synth.scheduleSamples).toHaveBeenCalledTimes(2);
  });

  it('resumes from where it was asked to, in the take', async () => {
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      await result.current.play(12_000);
    });

    const [[booked]] = synth.scheduleSamples.mock.calls as [
      [{ fromMs: number; startMs: number; endMs: number }[]]
    ];
    expect(booked[0].fromMs).toBe(12_000);
    // And runs only for what is left of it.
    expect(booked[0].endMs - booked[0].startMs).toBe(48_000);
  });

  it('sets its level on its bus, not on a second mixer', async () => {
    // The take used to carry a gain node of its own, which made balancing a
    // mix two mixers rather than one.
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      result.current.setLevel(0.4);
    });
    expect(synth.setBusLevel).toHaveBeenCalledWith(TAKE_BUS, 0.4);
  });

  it('INV-NOTES-205: stops by silencing the engine, not one bus', async () => {
    // Clearing the take's bus by index worked only while the transport's
    // idea of where the take was sounding matched the engine's. When that
    // stopped being true, pause did nothing and the take ran to its end
    // while the control correctly showed a pause glyph. Silence must not
    // be contingent on that bookkeeping.
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      await result.current.play();
    });
    await act(async () => {
      await result.current.stop();
    });

    expect(synth.clearAll).toHaveBeenCalled();
    expect(result.current.state).toBe('stopped');
  });

  it('pauses by silencing the engine too', async () => {
    const { result } = await renderHook(() => useTakeVoice({ resolveAudioUri: uri }));

    await act(async () => {
      await result.current.play();
    });
    synth.clearAll.mockClear();
    await act(async () => {
      await result.current.pause();
    });

    expect(synth.clearAll).toHaveBeenCalled();
    expect(result.current.state).toBe('stopped');
  });

  it('reports a take it cannot resolve rather than booking silence', async () => {
    const { result } = await renderHook(() =>
      useTakeVoice({ resolveAudioUri: () => Promise.resolve(null) })
    );

    await act(async () => {
      await result.current.play();
    });

    expect(synth.scheduleSamples).not.toHaveBeenCalled();
    expect(result.current.state).toBe('error');
  });

  it('gives the slot back when the note is left', async () => {
    const { result, unmount } = await renderHook(() =>
      useTakeVoice({ resolveAudioUri: uri })
    );

    await act(async () => {
      await result.current.play();
    });
    // Awaited: an unmount left in flight leaks into whatever runs next.
    await act(async () => {
      await unmount();
    });

    // Leaving a screen is a different act from stopping: it must not
    // silence something another screen started, so this clears only the
    // take's own bus (INV-NOTES-205).
    expect(synth.clearBus).toHaveBeenCalledWith(TAKE_BUS);
    expect(synth.unloadSample).toHaveBeenCalledWith(0);
  });
});
