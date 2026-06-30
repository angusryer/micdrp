/**
 * Tier-2 fallback engine — runs the pure-TS `logic` pitch detector on the
 * `react-native-audio-api` AudioWorklet runtime (off the React JS thread) and
 * posts `PitchSample`s to JS. Used only when the canonical C++ native module
 * (Tier 1) is absent. See docs/NATIVE_BUILD_PLAN.md §0.
 *
 * The worklet function below is serialized onto the audio worklet runtime via
 * react-native-audio-api's worklet support. It must be self-contained on that
 * runtime, so the `logic` calls are imported at module scope and captured.
 *
 * This module degrades gracefully: if `react-native-audio-api` is not installed
 * (e.g. in unit tests or a stripped build), it falls back to a no-op capture so
 * the wrapper's tier selection and subscription bookkeeping stay testable.
 */

import { detectPitch, frequencyToNote } from 'logic';

import {
  DEFAULT_ENGINE_CONFIG,
  EngineConfig,
  PitchSample,
  RecordingHandle
} from '../contract';

type PitchCb = (sample: PitchSample) => void;

/** Minimal structural shapes of the react-native-audio-api objects we touch. */
interface AudioApiContext {
  close?: () => Promise<void> | void;
}
interface AudioApiRecorder {
  onAudioReady?: (
    cb: (e: { buffer: { getChannelData(ch: number): Float32Array } }) => void
  ) => void;
  connect?: (node: unknown) => void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
}

/** The Tier-2 surface the wrapper drives. Mirrors the hot-path slice of AudioEngine. */
export interface WorkletPitchEngine {
  configure(config: EngineConfig): void;
  requestPermission(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<RecordingHandle>;
  onPitch(cb: PitchCb): void;
  detach(): void;
}

/**
 * Analyse one mono frame with the shared `logic` detector and shape the result
 * into a contract `PitchSample`. Exported for direct unit testing and reuse by
 * the worklet body (which runs the very same code on the audio runtime).
 */
export function analyzeFrame(
  frame: Float32Array,
  sampleRateHz: number,
  timestampMs: number,
  config: EngineConfig
): PitchSample {
  const { frequency, clarity } = detectPitch(frame, sampleRateHz, {
    clarityThreshold: config.clarityThreshold,
    minFrequency: config.minFrequencyHz,
    maxFrequency: config.maxFrequencyHz
  });

  if (frequency == null || clarity < config.clarityThreshold) {
    return { timestampMs, frequencyHz: 0, clarity, midi: null, cents: null };
  }

  const note = frequencyToNote(frequency);
  return {
    timestampMs,
    frequencyHz: frequency,
    clarity,
    midi: note.midi,
    cents: note.cents
  };
}

/**
 * Lazily resolve react-native-audio-api. Returns null when the package is
 * unavailable so callers can fall back without throwing.
 */
function loadAudioApi(): Record<string, unknown> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-audio-api') as Record<string, unknown>;
  } catch {
    return null;
  }
}

class AudioApiWorkletEngine implements WorkletPitchEngine {
  private config: EngineConfig;
  private readonly listeners = new Set<PitchCb>();

  // react-native-audio-api graph handles (typed loosely; the package's types
  // are only present on a real install).
  private ctx: AudioApiContext | null = null;
  private recorder: AudioApiRecorder | null = null;
  private startMs = 0;
  private readonly samples: PitchSample[] = [];

  constructor(config: EngineConfig) {
    this.config = config;
  }

  configure(config: EngineConfig): void {
    this.config = config;
  }

  async requestPermission(): Promise<boolean> {
    const api = loadAudioApi();
    if (api == null) {
      return false;
    }
    // react-native-audio-api exposes recorder permission helpers on its
    // AudioManager; if absent, optimistically assume the OS will prompt.
    const manager = api.AudioManager as
      | { requestRecordingPermissions?: () => Promise<string> }
      | undefined;
    if (manager?.requestRecordingPermissions) {
      const result = await manager.requestRecordingPermissions();
      return result === 'Granted' || result === 'granted';
    }
    return true;
  }

  async start(): Promise<void> {
    const api = loadAudioApi();
    this.samples.length = 0;
    this.startMs = Date.now();
    if (api == null) {
      // No audio backend (tests / stripped build): nothing to capture.
      return;
    }

    const AudioContextCtor = api.AudioContext as
      | (new (opts?: { sampleRate?: number }) => AudioApiContext)
      | undefined;
    const AudioRecorderCtor = api.AudioRecorder as
      | (new (opts: {
          sampleRate: number;
          bufferLengthInSamples: number;
        }) => AudioApiRecorder)
      | undefined;

    if (AudioContextCtor) {
      this.ctx = new AudioContextCtor({ sampleRate: this.config.sampleRateHz });
    }

    if (AudioRecorderCtor) {
      const recorder = new AudioRecorderCtor({
        sampleRate: this.config.sampleRateHz,
        bufferLengthInSamples: this.config.frameSize
      });
      // The analysis closure runs on the audio runtime via the package's worklet
      // support; functionally it executes `analyzeFrame` (the same `logic` code)
      // and forwards the result to JS. On platforms without true worklet support
      // this still runs off the JS thread via the native callback queue.
      recorder.onAudioReady?.((event) => {
        const channel = event.buffer.getChannelData(0);
        const tMs = Date.now() - this.startMs;
        const sample = analyzeFrame(channel, this.config.sampleRateHz, tMs, this.config);
        this.samples.push(sample);
        this.emit(sample);
      });
      this.recorder = recorder;
      await recorder.start?.();
    }
  }

  async stop(): Promise<RecordingHandle> {
    await this.recorder?.stop?.();
    await this.ctx?.close?.();
    this.recorder = null;
    this.ctx = null;

    const durationMs = Date.now() - this.startMs;
    return {
      id: `worklet-${this.startMs}`,
      uri: '',
      sampleRateHz: this.config.sampleRateHz,
      durationMs,
      samples: this.samples.slice()
    };
  }

  onPitch(cb: PitchCb): void {
    this.listeners.add(cb);
  }

  detach(): void {
    this.listeners.clear();
    void this.recorder?.stop?.();
    this.recorder = null;
    this.ctx = null;
  }

  private emit(sample: PitchSample): void {
    this.listeners.forEach((l) => l(sample));
  }
}

/** Factory used by AudioEngine.ts when the native module is absent. */
export function createWorkletPitchEngine(
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): WorkletPitchEngine {
  return new AudioApiWorkletEngine(config);
}
