/**
 * AudioEngine — the single TS implementation of the {@link AudioEngine} contract.
 *
 * Tier selection (see docs/NATIVE_BUILD_PLAN.md §0):
 *   • Tier 1 (canonical): `NativeModules.AudioEngineModule` is present — the C++
 *     DSP core runs on the real-time audio thread and pushes throttled
 *     `PitchSample` events over `NativeEventEmitter`. PCM never reaches JS.
 *   • Tier 2 (fallback): no native module — drive a `react-native-audio-api`
 *     AudioWorklet (src/audio/worklet/pitchProcessor.ts) that runs the pure-TS
 *     `logic` detector on the audio worklet runtime and posts `PitchSample`s.
 *
 * Screens import ONLY this wrapper (via the barrel), never the native module or
 * the worklet directly. Exposes both a named singleton `audioEngine` and a
 * default export.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import type { NativeModule } from 'react-native';

import {
  AudioEngine as AudioEngineContract,
  DEFAULT_ENGINE_CONFIG,
  EngineConfig,
  EngineState,
  PitchSample,
  RecordingHandle
} from './contract';
import { createWorkletPitchEngine, WorkletPitchEngine } from './worklet/pitchProcessor';

const PITCH_EVENT = 'AudioEnginePitch';
const STATE_EVENT = 'AudioEngineState';

type PitchListener = (sample: PitchSample) => void;
type StateListener = (state: EngineState) => void;

interface NativeAudioEngineModule {
  configure(config: Partial<EngineConfig>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<RecordingHandle>;
  requestPermission(): Promise<boolean>;
  // RCTEventEmitter parity (Android no-ops, iOS auto-provided).
  addListener?(eventName: string): void;
  removeListeners?(count: number): void;
}

function getNativeModule(): NativeAudioEngineModule | null {
  const mod = (NativeModules as Record<string, unknown>).AudioEngineModule;
  if (mod == null) {
    return null;
  }
  return mod as NativeAudioEngineModule;
}

/**
 * Normalize an arbitrary native event payload into a strict `PitchSample`.
 * Native sends `midi`/`cents` as `null` when unvoiced.
 */
function toPitchSample(raw: unknown): PitchSample {
  const o = (raw ?? {}) as Record<string, unknown>;
  const midi = o.midi;
  const cents = o.cents;
  return {
    timestampMs: typeof o.timestampMs === 'number' ? o.timestampMs : 0,
    frequencyHz: typeof o.frequencyHz === 'number' ? o.frequencyHz : 0,
    clarity: typeof o.clarity === 'number' ? o.clarity : 0,
    midi: typeof midi === 'number' ? midi : null,
    cents: typeof cents === 'number' ? cents : null
  };
}

class AudioEngineImpl implements AudioEngineContract {
  private readonly native: NativeAudioEngineModule | null;
  private readonly emitter: NativeEventEmitter | null;

  private config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };
  private state: EngineState = 'idle';

  private readonly pitchListeners = new Set<PitchListener>();
  private readonly stateListeners = new Set<StateListener>();

  // Tier-1 native subscriptions (lazily attached while listeners exist).
  private nativePitchSub: { remove(): void } | null = null;
  private nativeStateSub: { remove(): void } | null = null;

  // Tier-2 worklet engine (lazily created).
  private worklet: WorkletPitchEngine | null = null;
  private workletForwarderAttached = false;

  constructor() {
    this.native = getNativeModule();
    this.emitter = this.native
      ? new NativeEventEmitter(this.native as unknown as NativeModule)
      : null;
  }

  /** True when the canonical C++ native module is available. */
  get isNative(): boolean {
    return this.native != null && this.emitter != null;
  }

  /** Which tier is active: 1 = native C++, 2 = audio-api worklet fallback. */
  get tier(): 1 | 2 {
    return this.isNative ? 1 : 2;
  }

  async configure(config: Partial<EngineConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    if (this.native) {
      await this.native.configure(config);
    } else if (this.worklet) {
      this.worklet.configure(this.config);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (this.native) {
      return this.native.requestPermission();
    }
    return this.ensureWorklet().requestPermission();
  }

  async start(): Promise<void> {
    if (this.native) {
      this.attachNative();
      await this.native.start();
      return;
    }
    const w = this.ensureWorklet();
    this.setState('recording');
    await w.start();
  }

  async stop(): Promise<RecordingHandle> {
    if (this.native) {
      const handle = await this.native.stop();
      // Native already emits 'idle' via the state channel; mirror locally so a
      // caller without a state listener still sees a consistent value.
      this.state = 'idle';
      return this.normalizeHandle(handle);
    }
    const w = this.ensureWorklet();
    this.setState('analyzing');
    const handle = await w.stop();
    this.setState('idle');
    return this.normalizeHandle(handle);
  }

  onPitch(cb: PitchListener): () => void {
    this.pitchListeners.add(cb);
    this.attachNative();
    this.attachWorklet();
    return () => {
      this.pitchListeners.delete(cb);
      this.maybeDetach();
    };
  }

  onState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    this.attachNative();
    // Replay current coarse state so late subscribers are in sync.
    cb(this.state);
    return () => {
      this.stateListeners.delete(cb);
      this.maybeDetach();
    };
  }

  // ---- internals ----

  private setState(next: EngineState): void {
    this.state = next;
    this.stateListeners.forEach((l) => l(next));
  }

  private emitPitch(sample: PitchSample): void {
    this.pitchListeners.forEach((l) => l(sample));
  }

  private normalizeHandle(handle: RecordingHandle): RecordingHandle {
    return {
      ...handle,
      samples: Array.isArray(handle.samples) ? handle.samples.map(toPitchSample) : []
    };
  }

  private attachNative(): void {
    if (!this.emitter) {
      return;
    }
    if (this.nativePitchSub == null) {
      this.nativePitchSub = this.emitter.addListener(PITCH_EVENT, (raw: unknown) => {
        this.emitPitch(toPitchSample(raw));
      });
    }
    if (this.nativeStateSub == null) {
      this.nativeStateSub = this.emitter.addListener(STATE_EVENT, (raw: unknown) => {
        this.setState(raw as EngineState);
      });
    }
  }

  private ensureWorklet(): WorkletPitchEngine {
    if (this.worklet == null) {
      this.worklet = createWorkletPitchEngine(this.config);
    }
    return this.worklet;
  }

  private attachWorklet(): void {
    if (this.native || this.workletForwarderAttached) {
      return;
    }
    const w = this.ensureWorklet();
    // A single forwarder fans out to every JS subscriber; never registered twice.
    w.onPitch((raw) => this.emitPitch(toPitchSample(raw)));
    this.workletForwarderAttached = true;
  }

  private maybeDetach(): void {
    if (this.pitchListeners.size > 0 || this.stateListeners.size > 0) {
      return;
    }
    this.nativePitchSub?.remove();
    this.nativePitchSub = null;
    this.nativeStateSub?.remove();
    this.nativeStateSub = null;
    this.worklet?.detach();
    this.workletForwarderAttached = false;
  }
}

/** Process-wide singleton implementing the AudioEngine contract. */
export const audioEngine: AudioEngineImpl = new AudioEngineImpl();

export default audioEngine;
