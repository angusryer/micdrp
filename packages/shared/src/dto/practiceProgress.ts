/**
 * Practice-progress DTOs — one lightweight metrics row per finished practice
 * session. No audio is retained for practice; this trajectory powers the
 * Dashboard training trend. Self-contained primitives (no logic import).
 */
export interface PracticeProgressDto {
  id: string;
  userId: string;
  createdAtMs: number;
  /** Catalogue melody id the session practised. */
  melodyId: string;
  /** Tonic MIDI the exercise was built from. */
  rootMidi: number;
  /** Per-note duration the session used, in ms. */
  noteDurationMs: number;
  /** Overall 0..100 score, or null. */
  score: number | null;
  /** Fraction of frames within tune tolerance, 0..1, or null. */
  inTuneRatio: number | null;
  meanCentsError: number | null;
  evaluatedFrames: number;
}

/** Fields supplied by the client when recording a practice result. */
export interface CreatePracticeProgressInput {
  melodyId: string;
  rootMidi: number;
  noteDurationMs: number;
  score?: number | null;
  inTuneRatio?: number | null;
  meanCentsError?: number | null;
  evaluatedFrames: number;
}
