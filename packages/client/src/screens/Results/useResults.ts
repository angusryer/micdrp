/**
 * Offline analysis + cloud-persistence hook for the Results screen
 * (WP-CLIENT-ANALYSIS owns the Results wiring).
 *
 * Runs the canonical `logic` pipeline over the full-resolution
 * `RecordingHandle.samples` exactly once per handle, OFF the live audio path:
 *
 *   smoothPitch → segmentNotes → notesToMidi   (notes + exportable MIDI)
 *   computeFeedback(handle)                     (on-device FeedbackDto)
 *
 * The take is then persisted to the cloud via {@link recordingsRepo.create}: the
 * Supabase data layer uploads the audio + exported MIDI blobs to Storage and
 * inserts the row (key / tempo / score included), returning the canonical
 * {@link RecordingDto}. There is no local-only store here — the repo is the
 * single source of truth (see WP-CLIENT-DATA `sync.ts` for offline reconcile).
 *
 * Heavy work happens in a `useMemo` keyed on the handle id; persistence is a
 * one-shot effect guarded so React re-renders never re-upload. `PitchSample` is
 * structurally a logic `PitchFrame`, so `handle.samples` feeds the pipeline
 * directly with no copy.
 *
 * See docs/PROJECT_COMPLETION_PLAN.md §3 (WP-CLIENT-ANALYSIS).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  notesToMidi,
  segmentNotes,
  smoothPitch,
  type NoteEvent,
  type TargetNote
} from 'logic';
import type { FeedbackDto, RecordingDto } from 'shared';

import { computeFeedback } from '../../analysis/feedback';
import { recordingsRepo } from '../../data/recordingsRepo';
import { writeMidi } from '../../data/files';
import type { RecordingHandle } from '../../audio/contract';

/** Persistence status for the one-shot cloud save + MIDI write. */
export type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Render-ready analysis derived purely from a {@link RecordingHandle}. */
export interface ResultsAnalysis {
  /** Discrete sung notes after smoothing + segmentation. */
  notes: NoteEvent[];
  /** Standard MIDI File bytes for {@link notes}. */
  midi: Uint8Array;
  /** On-device coaching feedback (score, key, tempo, narrative, perNote). */
  feedback: FeedbackDto;
}

export interface UseResultsValue extends ResultsAnalysis {
  /** Echoes the source handle for child components (id / duration / uri). */
  handle: RecordingHandle;
  /** `file://` URI of the written `.mid`, once persisted (drives export/share). */
  midiUri: string | null;
  /** One-shot persistence status (cloud row + uploaded blobs). */
  status: PersistStatus;
  /** The persisted cloud record, once saved. */
  recording: RecordingDto | null;
}

export interface UseResultsOptions {
  /** User-facing title; defaults to a timestamped label. */
  title?: string;
  /** Wall-clock creation time; defaults to `Date.now()` (injectable for tests). */
  createdAtMs?: number;
  /** When false, skip cloud persistence / MIDI-write entirely (analysis still runs). */
  persist?: boolean;
  /**
   * Reference melody this take was sung against (practice mode). When present,
   * scoring + per-note feedback target this melody instead of the take itself.
   */
  targets?: readonly TargetNote[];
}

/** Pure: run the offline pipeline + feedback synthesis over a handle's samples. */
export function analyzeHandle(
  handle: RecordingHandle,
  targets?: readonly TargetNote[]
): ResultsAnalysis {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const midi = notesToMidi(notes);
  const feedback = computeFeedback(handle, targets);
  return { notes, midi, feedback };
}

function defaultTitle(createdAtMs: number): string {
  return `Take ${new Date(createdAtMs).toISOString().slice(0, 19).replace('T', ' ')}`;
}

/**
 * Analyse a finished capture and persist it to the cloud. Analysis is memoised
 * on the handle id; persistence (MIDI write + `recordingsRepo.create`) runs once
 * per id via an effect, guarded so React re-renders never duplicate the upload.
 */
export function useResults(
  handle: RecordingHandle,
  options: UseResultsOptions = {}
): UseResultsValue {
  const { title, createdAtMs, persist = true, targets } = options;

  const analysis = useMemo(
    () => analyzeHandle(handle, targets),
    // Analysis is a pure function of the handle's frames + the chosen melody;
    // a take's id is unique per capture, so it keys both safely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handle.id]
  );

  const [status, setStatus] = useState<PersistStatus>('idle');
  const [midiUri, setMidiUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingDto | null>(null);
  /** Ids already persisted this mount, so re-renders never re-upload. */
  const persistedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!persist || persistedRef.current.has(handle.id)) {
      return;
    }
    persistedRef.current.add(handle.id);

    let cancelled = false;
    setStatus('saving');

    const created = createdAtMs ?? Date.now();
    const { feedback, notes, midi } = analysis;

    void (async () => {
      try {
        // Keep the local `.mid` export/share path: write the file first so the
        // export sheet has a `file://` URI even before the upload resolves.
        const uri = await writeMidi(handle.id, midi);
        if (!cancelled) {
          setMidiUri(uri);
        }

        const saved = await recordingsRepo.create(
          {
            title: title ?? defaultTitle(created),
            durationMs: handle.durationMs,
            sampleRateHz: handle.sampleRateHz,
            noteCount: notes.length,
            score: feedback.overallScore,
            key: feedback.key,
            tempoBpm: feedback.tempoBpm
          },
          { audioUri: handle.uri, midiBytes: midi }
        );

        if (!cancelled) {
          setRecording(saved);
          setStatus('saved');
        }
      } catch {
        if (!cancelled) {
          // Allow a later mount to retry the upload for this id.
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
    feedback: analysis.feedback,
    midiUri,
    status,
    recording
  };
}
