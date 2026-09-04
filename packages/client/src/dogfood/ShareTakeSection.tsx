/**
 * The share row, wired to a take.
 *
 * A component rather than a few lines inside the details sheet, so the
 * notes screen keeps knowing nothing about samples: it hands over a take
 * and the way to reach its audio, and what that becomes is this domain's
 * business.
 */
import React, { useMemo } from 'react';
import type { NoteEventDto, ReadableTake } from 'shared';

import { hasTakeAudio } from '../data/takeAudio';
import { ShareTakeControl } from './ShareTakeControl';
import { useTakeShare } from './useTakeShare';

/** A take, as much of one as sharing needs. */
export type ShareableTake = ReadableTake & {
  id: string;
  title: string;
  durationMs: number;
  sampleRateHz: number;
  audioPath?: string | null;
  localAudioUri?: string | null;
};

export interface ShareTakeSectionProps {
  note: ShareableTake;
  /**
   * The melody as the graph draws it — the reading with any corrections
   * replayed onto it. Sent beside the raw hearing, because the difference
   * between the two is the mistake stated by the only person who knows.
   */
  melody: NoteEventDto[];
  /** The take's audio, by the rule the player and the re-read both use. */
  resolveAudio: () => Promise<string | null>;
}

export function ShareTakeSection({
  note,
  melody,
  resolveAudio
}: ShareTakeSectionProps): React.JSX.Element {
  const input = useMemo(
    () => ({
      noteId: note.id,
      title: note.title,
      durationMs: note.durationMs,
      sampleRateHz: note.sampleRateHz,
      take: note,
      corrected: melody,
      audioPath: note.audioPath ?? null,
      resolveAudio
    }),
    [note, melody, resolveAudio]
  );
  const share = useTakeShare(input);

  return <ShareTakeControl share={share} hasAudio={hasTakeAudio(note)} />;
}

export default ShareTakeSection;
