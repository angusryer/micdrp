/**
 * INV-NOTES-134 — a layer is heard as it was sung, not as it was read.
 *
 * A layer used to reach the ear only as a synthesized reading of what was
 * detected in it: the bass line arrived as an oscillator playing the notes we
 * thought we heard. A layer is a performance, and it now sounds as one — its
 * own slot, its own bus, the take's clock.
 *
 * `renderHook` is async in this setup — await it.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { NoteLayerDto } from 'shared';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

jest.mock('../../../data/notesRepo', () => ({
  notesRepo: {
    audioUrlFor: (_id: string, path: string | null) => Promise.resolve(path)
  }
}));

import {
  audibleLayers,
  layersWithoutAVoice,
  useLayerVoices
} from '../useLayerVoices';
import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';
import { MAX_LAYER_VOICES, TAKE_SLOT } from '../sampleSlots';
import { trackBus } from '../trackRegistry';

/**
 * Asked of the registry rather than written down: a bus is a position in the
 * track list, so inserting a track shifts every number after it and a literal
 * here would pin the wrong one (INV-NOTES-121).
 */
const LAYERS_BUS = trackBus('layers');

const TAKE_MS = 60_000;

const layer = (over: Partial<NoteLayerDto> = {}): NoteLayerDto => ({
  id: 'layer-1',
  role: 'bass',
  audioPath: 'file:///bass.m4a',
  melody: [],
  alignedByMs: 0,
  isMuted: false,
  ...over
});

beforeEach(resetSynthDouble);

describe('which layers get a voice', () => {
  it('gives each one a slot of its own, and never the take’s', () => {
    const slots = audibleLayers([
      layer({ id: 'a' }),
      layer({ id: 'b' }),
      layer({ id: 'c' })
    ]).map((one) => one.slot);
    expect(new Set(slots).size).toBe(3);
    expect(slots).not.toContain(TAKE_SLOT);
  });

  it('leaves out a muted one rather than loading it to be silent', () => {
    // Silence is what a mute means, and holding a whole recording in memory
    // to not play it is a cost with nothing on the other side of it.
    expect(audibleLayers([layer({ isMuted: true })])).toEqual([]);
  });

  it('leaves out one with nothing recorded in it', () => {
    expect(audibleLayers([layer({ audioPath: null })])).toEqual([]);
  });

  it('stops at the number of slots there are, and says how many were left', () => {
    const many = Array.from({ length: MAX_LAYER_VOICES + 2 }, (_, i) =>
      layer({ id: `l${i}` })
    );
    expect(audibleLayers(many)).toHaveLength(MAX_LAYER_VOICES);
    expect(layersWithoutAVoice(many)).toBe(2);
  });

  it('counts none left out when they all fit', () => {
    expect(layersWithoutAVoice([layer()])).toBe(0);
  });
});

describe('sounding the layers with the take', () => {
  it('decodes each one when the note is opened, not when play is pressed', async () => {
    await renderHook(() => useLayerVoices('note-1', [layer()], TAKE_MS));
    await waitFor(() => expect(synth.loadSample).toHaveBeenCalled());
    expect(synth.loadSample).toHaveBeenCalledWith(1, 'file:///bass.m4a');
  });

  it('schedules them on the layers bus at the engine’s own now', async () => {
    const { result } = await renderHook(() =>
      useLayerVoices('note-1', [layer()], TAKE_MS)
    );
    await act(async () => {
      result.current.start();
    });

    const [[booked]] = synth.scheduleSamples.mock.calls as [
      [{ bus: number; slot: number; fromMs: number; endMs: number }[]]
    ];
    expect(booked[0].bus).toBe(LAYERS_BUS);
    expect(booked[0].slot).toBe(1);
  });

  it('pulls an overdub back by the latency it recorded', async () => {
    // An overdub is heard by the microphone after the output and input
    // latencies, so it sits late by a fixed amount.
    const { result } = await renderHook(() =>
      useLayerVoices('note-1', [layer({ alignedByMs: 120 })], TAKE_MS)
    );
    await act(async () => {
      result.current.start(4000);
    });

    const [[booked]] = synth.scheduleSamples.mock.calls as [
      [{ fromMs: number }[]]
    ];
    expect(booked[0].fromMs).toBe(4120);
  });

  it('says it has no length when there is nothing audible to hear', async () => {
    // A voice claiming a duration it cannot fill would hold the transport
    // open over silence.
    const { result } = await renderHook(() =>
      useLayerVoices('note-1', [layer({ isMuted: true })], TAKE_MS)
    );
    expect(result.current.durationMs).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it('stops by silencing its own bus, leaving the take alone', async () => {
    const { result } = await renderHook(() =>
      useLayerVoices('note-1', [layer()], TAKE_MS)
    );
    await act(async () => {
      result.current.stop();
    });
    expect(synth.clearBus).toHaveBeenCalledWith(LAYERS_BUS);
  });

  it('gives every slot back when the note is left', async () => {
    const { unmount } = await renderHook(() =>
      useLayerVoices('note-1', [layer(), layer({ id: 'b' })], TAKE_MS)
    );
    await waitFor(() => expect(synth.loadSample).toHaveBeenCalledTimes(2));
    // Awaited: an unmount left in flight leaks into whatever runs next.
    await act(async () => {
      await unmount();
    });
    expect(synth.unloadSample).toHaveBeenCalledWith(1);
    expect(synth.unloadSample).toHaveBeenCalledWith(2);
  });
});
