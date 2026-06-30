/**
 * Feedback DTO — produced on-device from the `logic` pipeline after a take and
 * shown in Results. Self-contained primitives (no logic import).
 */
export interface NoteFeedback {
  /** Position in the sung sequence. */
  index: number;
  midi: number;
  /** Signed cents error from the nearest target/grid note. */
  centsError: number;
  inTune: boolean;
}

export interface FeedbackDto {
  /** Overall 0..100. */
  overallScore: number;
  /** Fraction of notes within tolerance, 0..1. */
  inTuneRatio: number;
  meanCentsError: number;
  key: string | null;
  tempoBpm: number | null;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  perNote: NoteFeedback[];
}
