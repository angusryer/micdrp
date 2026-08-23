/**
 * The second takes sung against this one, and how they are kept.
 *
 * Split from useNoteDetail, which describes the take. A layer is a different
 * thing about the same note: a performance of the part the melody could only
 * imply (INV-NOTES-071).
 *
 * Held in state rather than read straight off the cache, so a layer just sung
 * changes the reading immediately instead of waiting for a sync to come back
 * round.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { NoteLayerDto } from 'shared';

import { notesRepo } from '../../data/notesRepo';
import { useLayerCapture } from './useLayerCapture';

export function useNoteLayers(
  noteId: string | null,
  stored: readonly NoteLayerDto[] | undefined
) {
  // Held here rather than read straight off the cache, so a layer just sung
  // changes the reading without waiting for a sync to come back round.
  const [layers, setLayers] = useState<NoteLayerDto[]>([...(stored ?? [])]);
  useEffect(() => setLayers([...(stored ?? [])]), [stored]);

  const bass = useMemo(
    () => layers.find((layer) => layer.role === 'bass')?.melody,
    [layers]
  );

  const layerCapture = useLayerCapture(noteId ?? null, layers, setLayers);

  /** Silence a layer for listening, which never changes what is read. */
  const setLayerMuted = useCallback(
    (layerId: string, isMuted: boolean) => {
      setLayers((current) => {
        const next = current.map((layer) =>
          layer.id === layerId ? { ...layer, isMuted } : layer
        );
        if (noteId) {
          void notesRepo.saveLayers(noteId, next);
        }
        return next;
      });
    },
    [noteId]
  );

  return { layers, bass, layerCapture, setLayerMuted };
}

export default useNoteLayers;
