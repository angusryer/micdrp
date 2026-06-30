/**
 * Offline analysis + practice-trajectory persistence for the Results screen.
 *
 * Results is reached after a practice take. It runs the canonical `logic`
 * pipeline over the full-resolution `RecordingHandle.samples` exactly once per
 * handle, OFF the live audio path:
 *
 *   smoothPitch → segmentNotes → notesToMidi   (notes + exportable MIDI)
 *   scorePitch(reference melody)               (score / in-tune / cents / frames)
 *   computeFeedback(handle, targets)           (on-device coaching FeedbackDto)
 *
 * Unlike a note, a practice take is NOT kept: no audio is uploaded. Instead one
 * lightweight {@link practiceProgressRepo.create} row records the session's
 * metrics for the Dashboard training trend. The MIDI is still written locally so
 * the singer can export their attempt.
 *
 * Heavy work happens in a `useMemo` keyed on the handle id; persistence is a
 * one-shot effect guarded so React re-renders never duplicate the write.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  notesToMidi,
  scorePitch,
  segmentNotes,
  smoothPitch,
  type NoteEvent,
  type PitchScore,
  type TargetNote
} from 'logic';
import type { FeedbackDto, PracticeProgressDto } from 'shared';

import { computeFeedback } from '../../analysis/feedback';
import { practiceProgressRepo } from '../../data/practiceProgressRepo';
import { writeMidi } from '../../data/files';
import type { RecordingHandle } from '../../audio/contract';
import type { PracticeParams } from '../../navigation/types';

/** Persistence status for the one-shot progress write + MIDI write. */
export type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Self-referential target grid: each note targets its own span. */
function selfTargets(notes: readonly NoteEvent[]): TargetNote[] {
  return notes.map((n) => ({ midi: n.midi, startMs: n.startMs, endMs: n.endMs }));
}

/** Render-ready analysis derived purely from a {@link RecordingHandle}. */
export interface ResultsAnalysis {
  /** Discrete sung notes after smoothing + segmentation. */
  notes: NoteEvent[];
  /** Standard MIDI File bytes for {@link notes}. */
  midi: Uint8Array;
  /** Frame-level pitch score against the reference (or self) target grid. */
  score: PitchScore;
  /** On-device coaching feedback (score, key, tempo, narrative, perNote). */
  feedback: FeedbackDto;
}

export interface UseResultsValue extends ResultsAnalysis {
  /** Echoes the source handle for child components (id / duration / uri). */
  handle: RecordingHandle;
  /** `file://` URI of the written `.mid`, once persisted (drives export/share). */
  midiUri: string | null;
  /** One-shot persistence status (practice-progress row). */
  status: PersistStatus;
  /** The persisted trajectory row, once saved. */
  progress: PracticeProgressDto | null;
}

export interface UseResultsOptions {
  /** When false, skip persistence / MIDI-write entirely (analysis still runs). */
  persist?: boolean;
  /**
   * Reference melody this take was sung against. Scoring + per-note feedback
   * target this melody instead of the take itself.
   */
  targets?: readonly TargetNote[];
  /** Practice identity — the trajectory row is written from these fields. */
  practice?: PracticeParams;
}

/** Pure: run the offline pipeline + scoring + feedback over a handle's samples. */
export function analyzeHandle(
  handle: RecordingHandle,
  targets?: readonly TargetNote[]
): ResultsAnalysis {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const midi = notesToMidi(notes);
  const grid = targets && targets.length > 0 ? [...targets] : selfTargets(notes);
  const score = scorePitch(smoothed, grid);
  const feedback = computeFeedback(handle, targets);
  return { notes, midi, score, feedback };
}

/**
 * Analyse a finished practice capture and persist its trajectory. Analysis is
 * memoised on the handle id; persistence (MIDI write + `practiceProgressRepo`)
 * runs once per id via an effect, guarded so re-renders never duplicate it.
 */
export function useResults(
  handle: RecordingHandle,
  options: UseResultsOptions = {}
): UseResultsValue {
  const { persist = true, targets, practice } = options;

  const analysis = useMemo(
    () => analyzeHandle(handle, targets),
    // Analysis is a pure function of the handle's frames + the chosen melody;
    // a take's id is unique per capture, so it keys both safely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handle.id]
  );

  const [status, setStatus] = useState<PersistStatus>('idle');
  const [midiUri, setMidiUri] = useState<string | null>(null);
  const [progress, setProgress] = useState<PracticeProgressDto | null>(null);
  /** Ids already persisted this mount, so re-renders never re-write. */
  const persistedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!persist || !practice || persistedRef.current.has(handle.id)) {
      return;
    }
    persistedRef.current.add(handle.id);

    let cancelled = false;
    setStatus('saving');

    const { score, midi } = analysis;

    void (async () => {
      try {
        // Keep a local `.mid` export of the attempt (no audio is retained).
        const uri = await writeMidi(handle.id, midi);
        if (!cancelled) {
          setMidiUri(uri);
        }

        const saved = await practiceProgressRepo.create({
          melodyId: practice.melodyId,
          rootMidi: practice.rootMidi,
          noteDurationMs: practice.noteDurationMs,
          score: score.score,
          inTuneRatio: score.inTuneRatio,
          meanCentsError: score.meanCentsError,
          evaluatedFrames: score.evaluatedFrames
        });

        if (!cancelled) {
          setProgress(saved);
          setStatus('saved');
        }
      } catch {
        if (!cancelled) {
          // Allow a later mount to retry the write for this id.
          persistedRef.current.delete(handle.id);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle.id, analysis, persist]);

  return {
    handle,
    notes: analysis.notes,
    midi: analysis.midi,
    score: analysis.score,
    feedback: analysis.feedback,
    midiUri,
    status,
    progress
  };
}
