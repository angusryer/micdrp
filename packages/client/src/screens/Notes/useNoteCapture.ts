/**
 * useNoteCapture — capture a sung "note" and save it.
 *
 * Wraps {@link useRecordController} (engine + shared values + machine) and adds
 * the save pipeline: on stop, analyse the capture into its symbolic melody +
 * descriptive metrics ({@link analyzeCapture}) and persist it via
 * {@link notesRepo.create} (audio blob + `melody_json` row). There is no score
 * gate — every capture is a keeper.
 *
 * The per-frame pitch stream still flows only through the controller's shared
 * values (UI thread); this hook adds no per-frame work. The save runs off the
 * live audio path, after the engine has stopped.
 */
import { useCallback, useRef, useState } from 'react';
import { type SharedValue } from 'react-native-reanimated';

import { analyzeCapture } from '../../analysis/note';
import { notesRepo } from '../../data/notesRepo';
import {
  useRecordController,
  type RecordController
} from '../capture/useRecordController';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseNoteCaptureValue {
  /** Latest pitch / cents / transport clock for the capture UI (UI thread). */
  sharedMidi: SharedValue<number>;
  sharedCents: SharedValue<number>;
  sharedFrame: SharedValue<number>;
  /** Coarse machine state for the transport. */
  state: RecordController['state'];
  isRecording: boolean;
  /** Begin capture (requests mic permission). Swallows a denied permission. */
  start(): void;
  /** Stop, analyse, and save the capture as a note. */
  stopAndSave(title?: string): Promise<void>;
  /** One-shot save status for the most recent capture. */
  saveStatus: SaveStatus;
}

/** A timestamped default title, e.g. "Note 2026-06-30 14:05". */
function defaultTitle(now: Date): string {
  return `Note ${now.toISOString().slice(0, 16).replace('T', ' ')}`;
}

export function useNoteCapture(onSaved?: () => void): UseNoteCaptureValue {
  const controller = useRecordController();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // Guard against a double-tap stop saving the same capture twice.
  const savingRef = useRef(false);

  const start = useCallback((): void => {
    setSaveStatus('idle');
    controller.start().catch(() => undefined);
  }, [controller]);

  const stopAndSave = useCallback(
    async (title?: string): Promise<void> => {
      if (savingRef.current) {
        return;
      }
      savingRef.current = true;
      try {
        const handle = await controller.stop();
        setSaveStatus('saving');
        const { noteInput } = analyzeCapture(handle);
        await notesRepo.create(
          { title: title?.trim() || defaultTitle(new Date()), ...noteInput },
          { audioUri: handle.uri }
        );
        setSaveStatus('saved');
        onSaved?.();
      } catch {
        setSaveStatus('error');
      } finally {
        savingRef.current = false;
      }
    },
    [controller, onSaved]
  );

  return {
    sharedMidi: controller.sharedMidi,
    sharedCents: controller.sharedCents,
    sharedFrame: controller.sharedFrame,
    state: controller.state,
    isRecording: controller.isRecording,
    start,
    stopAndSave,
    saveStatus
  };
}

export default useNoteCapture;
