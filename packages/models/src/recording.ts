import type { PitchSample } from './pitch';

/** Lifecycle of a capture session, mirrored by the client XState machine. */
export type RecordingStatus = 'idle' | 'recording' | 'analyzing' | 'complete';

/** A captured and analysed take. */
export interface Recording {
  id: string;
  /** Wall-clock creation time, ms since epoch. */
  createdAtMs: number;
  /** Capture sample rate in Hz (e.g. 44100). */
  sampleRateHz: number;
  /** Total duration in milliseconds. */
  durationMs: number;
  /** Per-frame pitch analysis, in capture order. */
  samples: PitchSample[];
}
