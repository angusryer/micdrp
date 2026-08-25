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

import { addTap, type TappedBeat } from 'logic';

import { analyzeCapture } from '../../analysis/note';
import { keepLocally, localNoteId, putNote } from '../../data/notesLocal';
import { flushPending } from '../../data/notesQueue';
import { firstInterpretation } from './capturedBeats';
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
  /**
   * Tap the beat while the take is being sung (INV-NOTES-137). Stamped
   * against the capture's own clock, and ignored when nothing is running.
   */
  tapBeat(): void;
  /** How many have been tapped this capture, so there is something to see. */
  tappedCount: number;
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
  // Held in a ref and mirrored to a count: a press must not re-render the
  // view drawing the pitch, and the only thing anyone needs to see is how
  // many there are.
  const beats = useRef<readonly TappedBeat[]>([]);
  const [tappedCount, setTappedCount] = useState(0);
  // Guard against a double-tap stop saving the same capture twice.
  const savingRef = useRef(false);

  const start = useCallback((): void => {
    setSaveStatus('idle');
    beats.current = [];
    setTappedCount(0);
    controller.start().catch(() => undefined);
  }, [controller]);

  /**
   * A tap, on the capture's own timeline.
   *
   * Only while something is running. A tap against a stopped capture has no
   * moment to be at, so it would land wherever the last one did — a beat
   * placed by accident (INV-NOTES-130).
   */
  const tapBeat = useCallback((): void => {
    if (!controller.isRecording) {
      return;
    }
    beats.current = addTap(beats.current, controller.elapsedMs());
    setTappedCount(beats.current.length);
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
        const at = Date.now();
        // Kept here, now, before anything is sent. What was sung is a fact
        // the moment it was sung; where it ends up stored is a detail that
        // can be retried (INV-NOTES-139).
        const note = keepLocally(
          { title: title?.trim() || defaultTitle(new Date()), ...noteInput },
          handle.uri,
          localNoteId(at, String(handle.durationMs ?? 0))
        );
        // What was tapped while singing is the note's beats, so opening it
        // shows them where they were put (INV-NOTES-137).
        if (beats.current.length > 0) {
          putNote({
            ...note,
            interpretations: [firstInterpretation(beats.current, at)]
          });
        }
        setSaveStatus('saved');
        onSaved?.();
      } catch {
        setSaveStatus('error');
      } finally {
        savingRef.current = false;
      }
      // Afterwards, and allowed to fail: the note is already kept. Caught
      // rather than left to float — an upload that cannot happen is an
      // ordinary state of the world, not an unhandled rejection.
      void flushPending().catch(() => undefined);
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
    tapBeat,
    tappedCount,
    saveStatus
  };
}

export default useNoteCapture;
