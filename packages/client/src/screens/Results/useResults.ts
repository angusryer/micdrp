/**
 * Offline analysis hook for the Results screen (WP-RESULTS-UI).
 *
 * Runs the canonical `logic` pipeline over the full-resolution
 * `RecordingHandle.samples` exactly once per handle, OFF the live audio path:
 *
 *   smoothPitch → segmentNotes → notesToMidi  (and optional scorePitch)
 *
 * The result is a small, render-ready view model plus a persisted
 * {@link RecordingMeta} and an on-disk `.mid`. The heavy work happens in a
 * `useMemo` keyed on the handle id, and persistence is a one-shot effect so a
 * re-render never re-writes files. `PitchSample` is structurally a logic
 * `PitchFrame`, so `handle.samples` feeds the pipeline directly with no copy.
 *
 * See docs/NATIVE_BUILD_PLAN.md §2 (contract) and §3 (WP-RESULTS-UI).
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

import { writeMidi } from '../../data/files';
import { saveRecording, type RecordingMeta } from '../../data/recordings';
import type { RecordingHandle } from '../../audio/contract';

/** Persistence status for the one-shot save + MIDI write. */
export type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Render-ready analysis derived purely from a {@link RecordingHandle}. */
export interface ResultsAnalysis {
  /** Discrete sung notes after smoothing + segmentation. */
  notes: NoteEvent[];
  /** Standard MIDI File bytes for {@link notes}. */
  midi: Uint8Array;
  /** Pitch score vs. the supplied target melody, or null when no target given. */
  score: PitchScore | null;
}

export interface UseResultsValue extends ResultsAnalysis {
  /** Echoes the source handle for child components (id / duration / uri). */
  handle: RecordingHandle;
  /** `file://` URI of the written `.mid`, once persisted. */
  midiUri: string | null;
  /** One-shot persistence status (index record + `.mid` blob). */
  status: PersistStatus;
  /** The persisted index record, once saved. */
  meta: RecordingMeta | null;
}

export interface UseResultsOptions {
  /** Reference melody to score against. When omitted, no score is computed. */
  target?: TargetNote[];
  /** User-facing title; defaults to a timestamped label. */
  title?: string;
  /** Wall-clock creation time; defaults to `Date.now()` (injectable for tests). */
  createdAtMs?: number;
  /** When false, skip persistence/MIDI-write entirely (analysis still runs). */
  persist?: boolean;
}

/** Pure: run the full offline pipeline over a handle's samples. */
export function analyzeHandle(
  handle: RecordingHandle,
  target?: TargetNote[]
): ResultsAnalysis {
  const smoothed = smoothPitch(handle.samples);
  const notes = segmentNotes(smoothed);
  const midi = notesToMidi(notes);
  const score =
    target != null && target.length > 0 ? scorePitch(smoothed, target) : null;
  return { notes, midi, score };
}

function defaultTitle(createdAtMs: number): string {
  return `Take ${new Date(createdAtMs).toISOString().slice(0, 19).replace('T', ' ')}`;
}

/**
 * Analyse a finished capture and persist it. Analysis is memoised on the handle
 * id; persistence (index save + `.mid` write) runs once per id via an effect and
 * is guarded so React re-renders never duplicate the disk writes.
 */
export function useResults(
  handle: RecordingHandle,
  options: UseResultsOptions = {}
): UseResultsValue {
  const { target, title, createdAtMs, persist = true } = options;

  const analysis = useMemo(
    () => analyzeHandle(handle, target),
    // Analysis is a pure function of the handle's frames + the target melody.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handle.id, target]
  );

  const [status, setStatus] = useState<PersistStatus>('idle');
  const [midiUri, setMidiUri] = useState<string | null>(null);
  const [meta, setMeta] = useState<RecordingMeta | null>(null);
  /** Ids already persisted this mount, so re-renders never re-write files. */
  const persistedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!persist || persistedRef.current.has(handle.id)) {
      return;
    }
    persistedRef.current.add(handle.id);

    let cancelled = false;
    setStatus('saving');

    const created = createdAtMs ?? Date.now();
    void (async () => {
      try {
        const uri = await writeMidi(handle.id, analysis.midi);
        const record: RecordingMeta = {
          id: handle.id,
          title: title ?? defaultTitle(created),
          createdAtMs: created,
          durationMs: handle.durationMs,
          sampleRateHz: handle.sampleRateHz,
          audioUri: handle.uri,
          midiUri: uri,
          noteCount: analysis.notes.length,
          ...(analysis.score != null ? { score: analysis.score.score } : {})
        };
        saveRecording(record);
        if (!cancelled) {
          setMidiUri(uri);
          setMeta(record);
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
    midiUri,
    status,
    meta
  };
}
