/**
 * Turning a second take into a layer of the first.
 *
 * The same detection as a take — one path, so a layer is never read by
 * different rules from the thing it was sung against (INV-NOTES-073) — and
 * then one thing more: it is moved back to where it was actually sung.
 *
 * A voice sung against playback reaches the microphone after the output and
 * input paths have both run, so every onset lands late. Uncorrected, every
 * downbeat the layer states is dragged late with it and the take reads worse
 * with the layer than without one (INV-NOTES-074).
 */
import {
  alignLayer,
  dropTooBriefToSing,
  mergeBends,
  recentreNotes,
  segmentNotes,
  smoothPitch,
  type NoteEvent
} from 'logic';
import type { NoteLayerDto, LayerRole } from 'shared';

import type { RecordingHandle } from '../audio/contract';
import { segmentOptions } from './segmentSettings';

export interface LayerCapture {
  /** The layer, ready to store beside the take it was sung over. */
  layer: NoteLayerDto;
  /** What was detected before alignment, for reporting what moved. */
  heard: NoteEvent[];
}

/**
 * Analyse a layer capture.
 *
 * `latencyMs` is what the audio session reported at the moment of recording.
 * Zero means it would not say, which is treated as "do not correct" rather
 * than "no latency": a wrong correction is worse than none, and a layer that
 * sits late is at least visibly late.
 */
export function analyzeLayer(
  handle: RecordingHandle,
  role: LayerRole,
  latencyMs: number
): LayerCapture {
  const smoothed = smoothPitch(handle.samples);
  // Read against the centre this layer was sung at, exactly as a take is: a
  // bass hummed a little flat throughout should still name the root it means
  // rather than the one it landed nearest (INV-PITCH-013).
  const { notes: heard } = recentreNotes(
    dropTooBriefToSing(mergeBends(segmentNotes(smoothed, segmentOptions())))
  );

  return {
    heard,
    layer: {
      id: handle.id,
      role,
      audioPath: handle.uri,
      melody: alignLayer(heard, latencyMs),
      alignedByMs: latencyMs > 0 ? latencyMs : 0,
      isMuted: false
    }
  };
}

export default analyzeLayer;
