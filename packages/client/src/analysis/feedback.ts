/**
 * On-device feedback synthesis (WP-CLIENT-ANALYSIS).
 *
 * Light post-take math that runs the canonical `logic` pipeline over a finished
 * {@link RecordingHandle} and distils it into a render-ready `shared`
 * {@link FeedbackDto}. The heavy real-time DSP already ran natively during the
 * take; this is a one-shot pass over the (already analysed) `PitchSample[]`:
 *
 *   smoothPitch → segmentNotes → scorePitch(self-target) ┐
 *                              → detectKey               ├→ FeedbackDto
 *                              → estimateTempo           ┘
 *
 * With no external reference melody, we score each sung note against ITSELF
 * (a per-note target grid built from the segmentation): the intonation question
 * becomes "how steadily did you hold each pitch you aimed for?", which is the
 * meaningful self-coaching signal for an unaccompanied vocal take. The same
 * frame-level `scorePitch` powers the number, so it stays consistent with the
 * Results `ScoreCard`.
 *
 * Pure and dependency-free beyond `logic`/`shared`; safe to call off the live
 * audio path. See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-ANALYSIS).
 */
import {
  detectKey,
  estimateTempo,
  scorePitch,
  segmentNotes,
  smoothPitch,
  type KeyEstimate,
  type NoteEvent,
  type PitchScore,
  type TargetNote
} from 'logic';
import {
  IN_TUNE_TOLERANCE_CENTS,
  type FeedbackDto,
  type NoteFeedback
} from 'shared';

import type { RecordingHandle } from '../audio/contract';

/** Score above which intonation is praised rather than flagged. */
const STRONG_SCORE = 85;
/** Score below which intonation is flagged as the headline improvement. */
const WEAK_SCORE = 60;
/** in-tune fraction above which steadiness is called out as a strength. */
const STRONG_IN_TUNE_RATIO = 0.8;
/** Confidence below which a key/tempo estimate is too weak to assert. */
const MIN_KEY_CONFIDENCE = 0.04;
/** Confidence below which a tempo estimate is too weak to assert. */
const MIN_TEMPO_CONFIDENCE = 0.4;

/**
 * Build a self-referential target grid: each segmented note becomes the target
 * for its own time span. Scoring against this grid measures how cleanly each
 * sustained pitch was held, with no external reference melody required.
 */
function selfTargets(notes: readonly NoteEvent[]): TargetNote[] {
  const targets: TargetNote[] = [];
  for (const n of notes) {
    targets.push({ midi: n.midi, startMs: n.startMs, endMs: n.endMs });
  }
  return targets;
}

/** Per-note feedback from the segmentation (mean cents deviation per note). */
function perNoteFeedback(notes: readonly NoteEvent[]): NoteFeedback[] {
  const out: NoteFeedback[] = [];
  // Index is part of each NoteFeedback, so this loop keeps the counter.
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    out.push({
      index: i,
      midi: n.midi,
      centsError: n.cents,
      inTune: Math.abs(n.cents) <= IN_TUNE_TOLERANCE_CENTS
    });
  }
  return out;
}

/** Human-readable key label, e.g. "A minor", or null when too weak to assert. */
function formatKey(key: KeyEstimate): string | null {
  if (key.confidence < MIN_KEY_CONFIDENCE) {
    return null;
  }
  return `${key.tonicName} ${key.mode}`;
}

/**
 * Compose the coaching narrative from the quantitative signals. Each bucket is
 * derived independently so the three lists never contradict each other and a
 * sparse take (few notes) still yields actionable, non-empty guidance.
 */
function narrate(
  score: PitchScore,
  noteCount: number,
  key: string | null,
  tempoBpm: number | null
): Pick<FeedbackDto, 'strengths' | 'improvements' | 'suggestions'> {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const suggestions: string[] = [];

  if (noteCount === 0) {
    improvements.push('No sustained notes were detected in this take.');
    suggestions.push(
      'Sing closer to the mic and hold each note a little longer so it can be tracked.'
    );
    return { strengths, improvements, suggestions };
  }

  // Intonation.
  if (score.score >= STRONG_SCORE) {
    strengths.push('Strong, accurate intonation across the take.');
  } else if (score.score < WEAK_SCORE) {
    improvements.push('Pitch drifted off target on several notes.');
    suggestions.push(
      'Slow down and sustain each note, checking it against a reference pitch.'
    );
  } else {
    improvements.push('Intonation was mostly solid but wandered in places.');
    suggestions.push('Practise sustained scales to tighten your pitch centre.');
  }

  // Steadiness (in-tune ratio).
  if (score.inTuneRatio >= STRONG_IN_TUNE_RATIO) {
    strengths.push('You held most notes steadily within tune.');
  } else if (score.evaluatedFrames > 0) {
    suggestions.push(
      'Focus on keeping pitch steady through the middle of each note, not just the attack.'
    );
  }

  // Mean cents error, as a sharp/flat tendency.
  if (score.meanCentsError > IN_TUNE_TOLERANCE_CENTS) {
    improvements.push(
      `Notes averaged ${Math.round(score.meanCentsError)} cents off centre.`
    );
  }

  // Musical context.
  if (key != null) {
    strengths.push(`Your take sits clearly in ${key}.`);
  }
  if (tempoBpm != null) {
    suggestions.push(
      `Your natural tempo is around ${tempoBpm} BPM — try a metronome there to lock your timing.`
    );
  }

  if (strengths.length === 0) {
    strengths.push('You committed to a full take from start to finish.');
  }

  return { strengths, improvements, suggestions };
}

/**
 * Run the full offline feedback pipeline over a finished capture and synthesize
 * a {@link FeedbackDto}. Pure: depends only on `handle.samples`.
 */
export function computeFeedback(handle: RecordingHandle): FeedbackDto {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const targets = selfTargets(notes);
  const score = scorePitch(smoothed, targets);
  const key = detectKey(notes);
  const tempo = estimateTempo(notes);

  const keyLabel = formatKey(key);
  const tempoBpm =
    tempo.bpm > 0 && tempo.confidence >= MIN_TEMPO_CONFIDENCE
      ? tempo.bpm
      : null;

  const narrative = narrate(score, notes.length, keyLabel, tempoBpm);

  return {
    overallScore: score.score,
    inTuneRatio: score.inTuneRatio,
    meanCentsError: score.meanCentsError,
    key: keyLabel,
    tempoBpm,
    perNote: perNoteFeedback(notes),
    ...narrative
  };
}

export default computeFeedback;
