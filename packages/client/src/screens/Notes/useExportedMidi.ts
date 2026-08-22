/**
 * useExportedMidi — the take written out as a MIDI file, ready to share.
 *
 * Generated from the stored symbolic melody rather than from the audio, so
 * exporting costs nothing and never re-touches the recording (INV-NOTES-003).
 */
import { useEffect, useState } from 'react';

import { notesToMidi, type NoteEvent } from 'logic';

import { writeMidi } from '../../data/files';

export function useExportedMidi(
  noteId: string | null,
  melody: readonly NoteEvent[]
): string | null {
  const [midiUri, setMidiUri] = useState<string | null>(null);
  useEffect(() => {
    if (!noteId || melody.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const uri = await writeMidi(noteId, notesToMidi(melody as NoteEvent[]));
        if (!cancelled) {
          setMidiUri(uri);
        }
      } catch {
        // Export simply stays unavailable if the write fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId, melody]);
  return midiUri;
}
