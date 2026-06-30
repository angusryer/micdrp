/**
 * Recording DTOs — the wire/row shape for a saved take. Self-contained
 * primitives (shared is the lowest layer; it must not import logic).
 * Client and backend map their own domain types to/from this.
 */
export interface RecordingDto {
  id: string;
  userId: string;
  title: string;
  createdAtMs: number;
  durationMs: number;
  sampleRateHz: number;
  noteCount: number;
  /** Overall 0..100 pitch score, or null if not scored. */
  score: number | null;
  /** Detected key, e.g. "A minor", or null. */
  key: string | null;
  tempoBpm: number | null;
  /** Storage path of the captured audio, or null. */
  audioPath: string | null;
  /** Storage path of the exported MIDI, or null. */
  midiPath: string | null;
}

/** Fields supplied by the client when creating a recording. */
export interface CreateRecordingInput {
  title: string;
  durationMs: number;
  sampleRateHz: number;
  noteCount: number;
  score?: number | null;
  key?: string | null;
  tempoBpm?: number | null;
}
