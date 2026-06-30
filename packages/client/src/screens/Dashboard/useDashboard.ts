/**
 * useDashboard — aggregates everything the Dashboard renders.
 *
 * Two cheap, cache-first sources:
 *   • the notes corpus  → `analyzeCorpus` (intervals, fragments, chord
 *     reflection, avoidance), recomputed on-device whenever the corpus changes;
 *   • the practice trajectory → the raw progress rows for the training trend.
 *
 * Both paint instantly from the MMKV cache, then sync from the cloud. The corpus
 * analysis is memoised on the melodies so it only recomputes when notes change
 * (the "on-device, on change" model) — never on the live audio path.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  analyzeCorpus,
  type ChordInferenceSettings,
  type CorpusAnalysis
} from 'logic';
import type { PracticeProgressDto } from 'shared';

import { cachedNotes, syncNotes } from '../../data/notesSync';
import {
  cachedPracticeProgress,
  syncPracticeProgress
} from '../../data/practiceProgressSync';
import { readChordInference } from '../Account/useAnalysisSettings';
import type { NoteMeta } from '../../data/notesCache';

export interface UseDashboardValue {
  /** Corpus insights (common patterns + avoidance), recomputed on change. */
  analysis: CorpusAnalysis;
  /** Practice-progress trajectory, oldest first. */
  progress: PracticeProgressDto[];
  /** Number of notes in the corpus (drives the empty state). */
  noteCount: number;
  loading: boolean;
  refresh(): Promise<void>;
}

export function useDashboard(): UseDashboardValue {
  const [notes, setNotes] = useState<NoteMeta[]>(() => {
    try {
      return cachedNotes();
    } catch {
      return [];
    }
  });
  const [progress, setProgress] = useState<PracticeProgressDto[]>(() => {
    try {
      return cachedPracticeProgress();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  // Chord-inference knobs are re-read on every load so tuning them (in Account &
  // Settings) takes effect on the next refresh.
  const [chordInference, setChordInference] = useState<ChordInferenceSettings>(
    () => readChordInference()
  );

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setChordInference(readChordInference());
    // Sync both sources independently; a failure in one keeps the other's cache.
    const [syncedNotes, syncedProgress] = await Promise.all([
      syncNotes().catch(() => cachedNotes()),
      syncPracticeProgress().catch(() => cachedPracticeProgress())
    ]);
    setNotes(syncedNotes);
    setProgress(syncedProgress);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recompute corpus insights only when the melodies or the tuning change.
  const analysis = useMemo<CorpusAnalysis>(
    () => analyzeCorpus(notes.map((n) => n.melody), chordInference),
    [notes, chordInference]
  );

  return {
    analysis,
    progress,
    noteCount: analysis.noteCount,
    loading,
    refresh: load
  };
}

export default useDashboard;
