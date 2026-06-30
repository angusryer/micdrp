/**
 * useAnalysisSettings — persisted chord-inference knobs.
 *
 * A monophonic melody only *implies* harmony, so the chord analysis is tuneable.
 * These knobs (window length, triads vs sevenths, key-relative labelling, and a
 * confidence floor) are persisted in the shared MMKV store and consumed by the
 * Dashboard's corpus analysis. The defaults live in `logic`
 * ({@link DEFAULT_CHORD_INFERENCE}) so the UI and the analysis never disagree.
 *
 * This hook is the single write-seam for analysis settings.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_CHORD_INFERENCE,
  type ChordInferenceSettings
} from 'logic';

import store from '../../data/store';

/** MMKV key — keep stable; changing it orphans existing persisted data. */
const KEY_ANALYSIS = 'settings:chordInference';

export interface UseAnalysisSettingsValue {
  /** Resolved settings: defaults merged with the user's persisted overrides. */
  chordInference: ChordInferenceSettings;
  /** Merge a partial override into the stored settings (PATCH, not PUT). */
  setChordInference(overrides: Partial<ChordInferenceSettings>): void;
  /** Reset chord-inference settings to the `logic` defaults. */
  resetChordInference(): void;
}

function load(): ChordInferenceSettings {
  const overrides = store.getJSON<Partial<ChordInferenceSettings>>(KEY_ANALYSIS);
  return { ...DEFAULT_CHORD_INFERENCE, ...(overrides ?? {}) };
}

export function useAnalysisSettings(): UseAnalysisSettingsValue {
  const [chordInference, setState] = useState<ChordInferenceSettings>(load);

  useEffect(() => {
    setState(load());
  }, []);

  const setChordInference = useCallback(
    (overrides: Partial<ChordInferenceSettings>): void => {
      const existing =
        store.getJSON<Partial<ChordInferenceSettings>>(KEY_ANALYSIS) ?? {};
      const next = { ...existing, ...overrides };
      store.setJSON(KEY_ANALYSIS, next);
      setState({ ...DEFAULT_CHORD_INFERENCE, ...next });
    },
    []
  );

  const resetChordInference = useCallback((): void => {
    store.remove(KEY_ANALYSIS);
    setState({ ...DEFAULT_CHORD_INFERENCE });
  }, []);

  return { chordInference, setChordInference, resetChordInference };
}

/** Read the persisted chord-inference settings without a hook (for data hooks). */
export function readChordInference(): ChordInferenceSettings {
  return load();
}

export default useAnalysisSettings;
