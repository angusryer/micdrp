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
  ANALYSIS_VERSION,
  alignLayer,
  type Hit,
  type NoteEvent
} from 'logic';
import type { NoteLayerDto, LayerRole } from 'shared';

import type { RecordingHandle } from '../audio/contract';
import { takeRoleFor } from './layerRoles';
import { readMelody } from './readMelody';

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
  // Read the way its role says. A bass line is all notes; a drum layer is all
  // hits. The role was being carried to storage and never consulted, so a
  // layer recorded as drums was read as singing (INV-NOTES-122).
  // The one reader, exactly as a take is read (INV-PITCH-028) — including
  // the re-centring, so a bass hummed a little flat throughout still names
  // the root it means rather than the one it landed nearest.
  const { notes: heard, hits } = readMelody(handle.samples, takeRoleFor(role));

  return {
    heard,
    layer: {
      id: handle.id,
      role,
      audioPath: handle.uri,
      melody: alignLayer(heard, latencyMs),
      hits: alignHits(hits, latencyMs),
      analysisVersion: ANALYSIS_VERSION,
      alignedByMs: latencyMs > 0 ? latencyMs : 0,
      isMuted: false
    }
  };
}

/**
 * Shift the hits by the same amount the notes were shifted.
 *
 * A layer is heard back through the speaker and recorded again, so everything
 * in it lands late by the round trip. Correcting the notes and not the hits
 * would put a drum and the note it was struck with in two different places
 * (INV-NOTES-074).
 */
function alignHits(hits: readonly Hit[], latencyMs: number): Hit[] {
  if (!(latencyMs > 0)) {
    return [...hits];
  }
  return hits.map((hit) => ({ ...hit, atMs: Math.max(0, hit.atMs - latencyMs) }));
}

export default analyzeLayer;
