/**
 * Recording a second take against the first.
 *
 * Sing the bassline you heard under the tune, while the tune plays. That is
 * the one thing the system cannot infer and the singer already knows, and it
 * settles both of the guesses a melody alone forces (INV-NOTES-071,
 * INV-NOTES-072).
 *
 * The order matters. Latency is read *before* the capture rather than after:
 * the route can change mid-take — headphones pulled out — and the number that
 * describes the recording is the one that was true when it started
 * (INV-NOTES-074).
 */
import { useCallback, useEffect, useState } from 'react';

import type { LayerRole, NoteLayerDto } from 'shared';

import { audioEngine } from '../../audio';
import { analyzeLayer } from '../../analysis/layer';
import { markBusy } from '../../updates';
import { notesRepo } from '../../data/notesRepo';

export interface LayerCaptureState {
  isRecording: boolean;
  /** What the round trip was measured at, once a layer has been captured. */
  alignedByMs: number | null;
  /** Begin. The caller starts the take playing; this only records. */
  start: (role: LayerRole) => Promise<void>;
  /** End, analyse, align, and keep it beside the take. */
  stop: () => Promise<NoteLayerDto | null>;
}

export function useLayerCapture(
  noteId: string | null,
  existing: readonly NoteLayerDto[],
  onLayers: (layers: NoteLayerDto[]) => void
): LayerCaptureState {
  const [isRecording, setIsRecording] = useState(false);
  const [alignedByMs, setAlignedByMs] = useState<number | null>(null);
  const [pending, setPending] = useState<{
    role: LayerRole;
    latencyMs: number;
    release: () => void;
  } | null>(null);

  const start = useCallback(async (role: LayerRole) => {
    if (!(await audioEngine.requestPermission())) {
      return;
    }
    // Asked now, while the route in use is the route this take will be sung
    // through.
    const latencyMs = await audioEngine.roundTripLatencyMs();
    // A modal over a live take costs the take, and this is a take
    // (INV-UPD-004).
    const release = markBusy('capture');
    // An overdub: the take has to keep sounding, and the microphone must not
    // hand the detector the take back through the speaker (INV-NOTES-087).
    await audioEngine.start(true);
    setPending({ role, latencyMs, release });
    setIsRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<NoteLayerDto | null> => {
    if (!pending) {
      return null;
    }
    const { role, latencyMs, release } = pending;
    setPending(null);
    setIsRecording(false);
    try {
      const handle = await audioEngine.stop();
      const { layer } = analyzeLayer(handle, role, latencyMs);
      setAlignedByMs(layer.alignedByMs);
      // One layer of each role: a second bass would be a second answer to a
      // question that has one, and nothing could say which was meant.
      const kept = [...existing.filter((l) => l.role !== role), layer];
      onLayers(kept);
      if (noteId) {
        await notesRepo.saveLayers(noteId, kept);
      }
      return layer;
    } finally {
      release();
    }
  }, [pending, existing, onLayers, noteId]);

  // Release the hold on the update prompt if this screen goes away mid-take.
  // It was released on stop and nowhere else, so leaving during an overdub
  // left the app busy for the rest of the session — and a prompt suppressed
  // that way is indistinguishable from no update at all (INV-UPD-024).
  useEffect(
    () => () => {
      pending?.release();
    },
    [pending]
  );

  return { isRecording, alignedByMs, start, stop };
}

export default useLayerCapture;
