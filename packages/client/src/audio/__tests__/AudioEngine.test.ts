/**
 * Unit tests for the AudioEngine wrapper.
 *
 * Verifies tier selection, native subscribe/emit/cleanup, and the Tier-2
 * worklet fallback — all with a mocked native module + event emitter, no device.
 */

// ---- controllable react-native mock ----
// A tiny in-process event bus stands in for RCTEventEmitter / DeviceEventEmitter.

type Handler = (payload: unknown) => void;

const bus: Record<string, Set<Handler>> = {};
const addListenerCalls: string[] = [];
const removeCalls: string[] = [];

function emit(event: string, payload: unknown): void {
  bus[event]?.forEach((h) => h(payload));
}

/** Mirrors a codegen event emitter: subscribe, get an EventSubscription back. */
function mockSubscribe(event: string, handler: Handler): { remove(): void } {
  addListenerCalls.push(event);
  if (!bus[event]) bus[event] = new Set();
  bus[event].add(handler);
  return {
    remove: () => {
      removeCalls.push(event);
      bus[event].delete(handler);
    }
  };
}

const mockNative = {
  configure: jest.fn((_config?: unknown) => Promise.resolve()),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() =>
    Promise.resolve({
      id: 'rec-1',
      uri: 'file:///tmp/rec-1.wav',
      sampleRateHz: 44100,
      durationMs: 1234,
      samples: [
        { timestampMs: 0, frequencyHz: 440, clarity: 0.99, midi: 69, cents: 0 },
        { timestampMs: 10, frequencyHz: 0, clarity: 0.1, midi: null, cents: null }
      ]
    })
  ),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  addListener: jest.fn(),
  removeListeners: jest.fn()
};

// Set BEFORE importing the module under test so getNativeModule() sees it.
// The engine is a TurboModule now, so the seam is the codegen spec module
// rather than NativeModules + NativeEventEmitter. Its event emitters take a
// listener and return an unsubscribe function.
jest.mock('../../specs/NativeAudioEngine', () => ({
  __esModule: true,
  default: {
    configure: (config: unknown) => mockNative.configure(config),
    start: () => mockNative.start(),
    stop: () => mockNative.stop(),
    requestPermission: () => mockNative.requestPermission(),
    onPitch: (handler: Handler) => mockSubscribe('pitch', handler),
    onState: (handler: Handler) => mockSubscribe('state', handler)
  }
}));

// Import AFTER the mock is registered. The module instantiates its singleton at
// import time using the mocked NativeModules.
import audioEngine, { audioEngine as namedEngine } from '../AudioEngine';

describe('AudioEngine (Tier 1 — native present)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    addListenerCalls.length = 0;
    removeCalls.length = 0;
    for (const k of Object.keys(bus)) delete bus[k];
  });

  it('exports the same singleton as default and named export', () => {
    expect(audioEngine).toBe(namedEngine);
  });

  it('runs on the engine, which is the only thing it runs on', () => {
    expect(audioEngine.isNative).toBe(true);
  });

  it('delivers throttled native pitch events to subscribers', () => {
    const received: unknown[] = [];
    const off = audioEngine.onPitch((s) => received.push(s));

    emit('pitch', {
      timestampMs: 5,
      frequencyHz: 220,
      clarity: 0.95,
      midi: 57,
      cents: -3
    });

    expect(received).toEqual([
      { timestampMs: 5, frequencyHz: 220, clarity: 0.95, midi: 57, cents: -3 }
    ]);
    off();
  });

  it('normalizes unvoiced frames (null midi/cents) from the native payload', () => {
    const received: Array<{ midi: number | null; cents: number | null }> = [];
    const off = audioEngine.onPitch((s) => received.push(s));

    emit('pitch', {
      timestampMs: 7,
      frequencyHz: 0,
      clarity: 0.2,
      midi: null,
      cents: null
    });

    expect(received[0].midi).toBeNull();
    expect(received[0].cents).toBeNull();
    off();
  });

  it('forwards native state transitions to onState subscribers', () => {
    const states: string[] = [];
    const off = audioEngine.onState((s) => states.push(s));
    // First call replays the current coarse state.
    expect(states[0]).toBe('idle');

    emit('state', 'recording');
    expect(states).toContain('recording');
    off();
  });

  it('removes the native subscription only when the last listener unsubscribes', () => {
    const offA = audioEngine.onPitch(() => undefined);
    const offB = audioEngine.onPitch(() => undefined);
    // One native addListener per event channel, shared across JS subscribers.
    expect(addListenerCalls.filter((e) => e === 'pitch')).toHaveLength(1);

    offA();
    expect(removeCalls).toHaveLength(0); // still one JS listener alive

    offB();
    // Now both pitch + state channels are torn down.
    expect(removeCalls).toContain('pitch');
  });

  it('proxies configure/start/requestPermission to the native module', async () => {
    await audioEngine.configure({ emitRateHz: 30 });
    expect(mockNative.configure).toHaveBeenCalledWith({ emitRateHz: 30 });

    await audioEngine.start();
    expect(mockNative.start).toHaveBeenCalled();

    await expect(audioEngine.requestPermission()).resolves.toBe(true);
  });

  it('returns a RecordingHandle with normalized samples on stop', async () => {
    const handle = await audioEngine.stop();
    expect(handle.id).toBe('rec-1');
    expect(handle.uri).toBe('file:///tmp/rec-1.wav');
    expect(handle.samples).toHaveLength(2);
    expect(handle.samples[1].midi).toBeNull();
  });
});

describe('the capture format contract (INV-PITCH-012)', () => {
  // The recorder and the decoder are two halves of one promise. Nothing used
  // to check they agreed, so a capture nothing could open shipped and every
  // note was silently unplayable until someone pressed play.
  const captureReturning = (uri: string) => ({
    id: 'rec-1',
    uri,
    sampleRateHz: 44100,
    durationMs: 1234,
    samples: []
  });

  it('complains, naming the format, when a capture cannot be played', async () => {
    const complain = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockNative.stop.mockResolvedValueOnce(captureReturning('file:///tmp/rec-1.caf'));
    await audioEngine.stop();
    expect(complain).toHaveBeenCalledWith(expect.stringContaining('caf'));
    complain.mockRestore();
  });

  it('says nothing when the capture is playable', async () => {
    const complain = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockNative.stop.mockResolvedValueOnce(captureReturning('file:///tmp/rec-1.wav'));
    await audioEngine.stop();
    expect(complain).not.toHaveBeenCalled();
    complain.mockRestore();
  });
});
