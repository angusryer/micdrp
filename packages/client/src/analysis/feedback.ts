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
  DEFAULT_TOLERANCE_CENTS,
  type KeyEstimate,
  type NoteEvent,
  type PitchFrame,
  type PitchScore,
  type TargetNote
} from 'logic';
import { type FeedbackDto, type NoteFeedback } from 'shared';

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

/**
 * Per-target feedback for a practice take: for each note of the reference
 * melody, average the signed cents error of the voiced frames that fell in its
 * time window. A target with no voiced frames is reported as not-in-tune (the
 * singer missed/skipped it). Used only when scoring against an external melody.
 */
function perTargetFeedback(
  frames: readonly PitchFrame[],
  targets: readonly TargetNote[]
): NoteFeedback[] {
  return targets.map((target, index) => {
    let sum = 0;
    let count = 0;
    for (const f of frames) {
      if (f.midi == null) {
        continue;
      }
      if (f.timestampMs >= target.startMs && f.timestampMs < target.endMs) {
        sum += (f.midi - target.midi) * 100 + (f.cents ?? 0);
        count++;
      }
    }
    const centsError = count > 0 ? sum / count : 0;
    return {
      index,
      midi: target.midi,
      centsError,
      inTune: count > 0 && Math.abs(centsError) <= DEFAULT_TOLERANCE_CENTS
    };
  });
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
      inTune: Math.abs(n.cents) <= DEFAULT_TOLERANCE_CENTS
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
  if (score.meanCentsError > DEFAULT_TOLERANCE_CENTS) {
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
 * a {@link FeedbackDto}. Pure: depends only on `handle.samples` (+ the optional
 * reference melody).
 *
 * When `externalTargets` is supplied (a practice take sung against a chosen
 * melody) the take is scored against THAT melody and `perNote` reports one entry
 * per target note. With no targets it falls back to the self-referential grid
 * (how steadily each sung note was held), the unaccompanied-take behaviour.
 */
export function computeFeedback(
  handle: RecordingHandle,
  externalTargets?: readonly TargetNote[]
): FeedbackDto {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const usingTargets = externalTargets != null && externalTargets.length > 0;
  const targets = usingTargets ? [...externalTargets] : selfTargets(notes);
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
    perNote: usingTargets
      ? perTargetFeedback(smoothed, targets)
      : perNoteFeedback(notes),
    ...narrative
  };
}

export default computeFeedback;
