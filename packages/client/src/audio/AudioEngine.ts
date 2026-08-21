/**
 * AudioEngine — the single TS implementation of the {@link AudioEngine} contract.
 *
 * Tier selection (see docs/NATIVE_BUILD_PLAN.md §0):
 *   • Tier 1 (canonical): the AudioEngineModule TurboModule is present — the
 *     C++ DSP core runs on the real-time audio thread and pushes throttled
 *     `PitchSample` events over the codegen event emitters. PCM never reaches
 *     JS.
 *   • Tier 2 (fallback): no native module — drive a `react-native-audio-api`
 *     AudioWorklet (src/audio/worklet/pitchProcessor.ts) that runs the pure-TS
 *     `logic` detector on the audio worklet runtime and posts `PitchSample`s.
 *
 * Screens import ONLY this wrapper (via the barrel), never the native module or
 * the worklet directly. Exposes both a named singleton `audioEngine` and a
 * default export.
 */

import NativeAudioEngine from '../specs/NativeAudioEngine';
import type { Spec as NativeAudioEngineModule } from '../specs/NativeAudioEngine';

import {
  AudioEngine as AudioEngineContract,
  DEFAULT_ENGINE_CONFIG,
  EngineConfig,
  EngineState,
  PitchSample,
  RecordingHandle
} from './contract';
import { createWorkletPitchEngine, WorkletPitchEngine } from './worklet/pitchProcessor';
import { ensureDirs, recordingsDir } from '../data/files';
import {
  PLAYABLE_AUDIO_EXTENSIONS,
  audioExtensionOf,
  isPlayableAudioPath
} from 'shared';

type PitchListener = (sample: PitchSample) => void;
type StateListener = (state: EngineState) => void;

/**
 * Resolve the TurboModule, or null when it is absent (a stripped build, or
 * Jest). Absence is not an error — it is what selects the Tier 2 fallback.
 */
function getNativeModule(): NativeAudioEngineModule | null {
  return NativeAudioEngine ?? null;
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

  private config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };
  private state: EngineState = 'idle';

  private readonly pitchListeners = new Set<PitchListener>();
  private readonly stateListeners = new Set<StateListener>();

  // Tier-1 native subscriptions (lazily attached while listeners exist).
  // Codegen event emitters hand back an EventSubscription.
  private nativePitchSub: { remove(): void } | null = null;
  private nativeStateSub: { remove(): void } | null = null;

  // Tier-2 worklet engine (lazily created).
  private worklet: WorkletPitchEngine | null = null;
  private workletForwarderAttached = false;

  constructor() {
    this.native = getNativeModule();
  }

  /** True when the canonical C++ native module is available. */
  get isNative(): boolean {
    return this.native != null;
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
      // The capture directory is owned by files.ts and handed to native, so a
      // capture lands somewhere durable rather than in a temporary directory
      // the system may reclaim while the note still points at it.
      await ensureDirs();
      await this.native.start(recordingsDir());
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

  /**
   * Adapt a handle from either tier into the strict contract shape. The
   * codegen type marks midi/cents optional; the contract requires them present
   * and nullable, and toPitchSample is what reconciles the two.
   */
  private normalizeHandle(handle: {
    id: string;
    uri: string;
    sampleRateHz: number;
    durationMs: number;
    samples: readonly unknown[];
  }): RecordingHandle {
    // The seam where the recorder's file meets the code that has to play it.
    // Nothing checked it before, so a capture written in a format the decoder
    // cannot open shipped and stayed shipped — every note silently unplayable
    // until someone pressed play (INV-PITCH-012). Complaining here names the
    // format, at the moment it is produced, rather than long afterwards.
    if (!isPlayableAudioPath(handle.uri)) {
      console.error(
        `[AudioEngine] captured ${audioExtensionOf(handle.uri) || 'an unnamed format'}, ` +
          `which playback cannot open. Expected one of ${PLAYABLE_AUDIO_EXTENSIONS.join(', ')}.`
      );
    }
    return {
      ...handle,
      samples: Array.isArray(handle.samples) ? handle.samples.map(toPitchSample) : []
    };
  }

  private attachNative(): void {
    const native = this.native;
    if (!native) {
      return;
    }
    if (this.nativePitchSub == null) {
      this.nativePitchSub = native.onPitch((raw) => {
        this.emitPitch(toPitchSample(raw));
      });
    }
    if (this.nativeStateSub == null) {
      this.nativeStateSub = native.onState((raw) => {
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
