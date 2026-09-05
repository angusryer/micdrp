/**
 * The layers, heard as they were sung (INV-NOTES-134).
 *
 * A layer used to reach the ear only as a synthesized reading of what was
 * detected in it — the bass line arrived as an oscillator playing the notes
 * we thought we heard. That is the wrong object. A layer is a performance,
 * and it now sounds as one: decoded into a slot of its own and scheduled
 * against the take on the same clock as everything else (INV-NOTES-133).
 *
 * Shaped as a mix voice like the chords and the click, so the transport does
 * not learn a new kind of thing. What it starts is every layer at once,
 * because they were all sung against the same take and there is only one
 * moment for them to start at.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { NoteLayerDto } from 'shared';

import { SCHEDULE_LEAD_MS, audioNowMs } from '../../audio/audioClock';
import { clearBus, hasEngine, setBusLevel } from '../../audio/engineBus';
import {
  loadSample,
  scheduleSamples,
  unloadSample
} from '../../audio/engineSamples';
import { notesRepo } from '../../data/notesRepo';
import { trackBus } from './trackRegistry';
import { MAX_LAYER_VOICES, layerSlot } from './sampleSlots';
import type { MixAccompaniment } from './usePlaybackMix';

/** A layer that can actually be heard: it has audio, and nobody silenced it. */
export interface AudibleLayer {
  layer: NoteLayerDto;
  slot: number;
}

/**
 * Which layers get a voice, and which slot each takes.
 *
 * A muted one is left out rather than loaded and silenced: silence is what a
 * mute means, and holding a whole recording in memory to not play it is a
 * cost with nothing on the other side of it.
 */
export function audibleLayers(
  layers: readonly NoteLayerDto[]
): AudibleLayer[] {
  const out: AudibleLayer[] = [];
  for (const layer of layers) {
    if (layer.isMuted || layer.audioPath == null) {
      continue;
    }
    const slot = layerSlot(out.length);
    if (slot == null) {
      break;
    }
    out.push({ layer, slot });
  }
  return out;
}

/** How many were left out for want of a slot, so it can be said out loud. */
export function layersWithoutAVoice(
  layers: readonly NoteLayerDto[]
): number {
  const wanted = layers.filter(
    (layer) => !layer.isMuted && layer.audioPath != null
  ).length;
  return Math.max(0, wanted - MAX_LAYER_VOICES);
}

export interface LayerVoices extends MixAccompaniment {
  /** How many are sounding, for anything that wants to say so. */
  count: number;
  /** And how many could not, for want of a slot. */
  silentForWantOfASlot: number;
}

export function useLayerVoices(
  noteId: string | null,
  layers: readonly NoteLayerDto[],
  takeDurationMs: number
): LayerVoices {
  const audible = useMemo(() => audibleLayers(layers), [layers]);
  /** Which layer each slot currently holds, so a reload is only a change. */
  const loaded = useRef(new Map<number, string>());

  // Loaded when the note is opened rather than when play is pressed: the
  // decode is the one slow step, and a press should be a schedule.
  useEffect(() => {
    if (noteId == null || !hasEngine()) {
      return;
    }
    const held = loaded.current;
    for (const { layer, slot } of audible) {
      if (held.get(slot) === layer.id) {
        continue;
      }
      held.set(slot, layer.id);
      void notesRepo
        .audioUrlFor(noteId, layer.audioPath)
        .then((url) => (url == null ? null : loadSample(slot, url)))
        .catch((err) => {
          console.warn('[useLayerVoices] could not load a layer', layer.id, err);
          held.delete(slot);
        });
    }
    // Slots this note no longer uses are given back, or the layer somebody
    // deleted goes on sounding.
    for (const slot of [...held.keys()]) {
      if (!audible.some((one) => one.slot === slot)) {
        held.delete(slot);
        unloadSample(slot);
      }
    }
  }, [audible, noteId]);

  useEffect(
    () => () => {
      for (const slot of [...loaded.current.keys()]) {
        unloadSample(slot);
      }
      loaded.current.clear();
      clearBus(trackBus('layers'));
    },
    []
  );

  const start = useCallback(
    (offsetMs = 0) => {
      if (audible.length === 0) {
        return;
      }
      const beginsAtMs = audioNowMs() + SCHEDULE_LEAD_MS;
      scheduleSamples(
        audible.map(({ layer, slot }) => ({
          bus: trackBus('layers'),
          slot,
          // Where in the layer the take has already reached. An overdub is
          // heard after the output and input latencies, so it sits late by
          // `alignedByMs` and is pulled back by exactly that.
          fromMs: Math.max(0, offsetMs + layer.alignedByMs),
          startMs: beginsAtMs,
          endMs: beginsAtMs + Math.max(0, takeDurationMs - offsetMs)
        }))
      );
    },
    [audible, takeDurationMs]
  );

  const stop = useCallback(() => {
    clearBus(trackBus('layers'));
  }, []);

  const setLevel = useCallback((level: number) => {
    setBusLevel(trackBus('layers'), level);
  }, []);

  return {
    start,
    stop,
    setLevel,
    // Only as long as there is something to hear; a voice claiming a duration
    // it cannot fill would hold the transport open over silence.
    durationMs: audible.length > 0 ? takeDurationMs : 0,
    count: audible.length,
    silentForWantOfASlot: layersWithoutAVoice(layers)
  };
}

export default useLayerVoices;
