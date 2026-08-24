/**
 * Rendering a NoteCard under the providers it expects.
 *
 * `await waitFor(() => render(...))` before touching any query, matching
 * CaptureSection.test.tsx — a bare render leaves `screen` unbound here. Each
 * caller uses the returned queries rather than the shared `screen`.
 *
 * The card no longer owns a player: one note sounds at a time and the screen
 * holds which (INV-NOTES-124). This stands in for that screen, so what the
 * card's own control does is still testable in one place.
 */
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import type { NoteMeta } from '../../../data/notesCache';
import { NoteCard } from '../NoteCard';

/** A 12-second note, with stored audio when `audioPath` is given. */
export const noteWith = (audioPath: string | null): NoteMeta =>
  ({
    id: 'n1',
    title: 'Hook idea',
    createdAtMs: 1_700_000_000_000,
    durationMs: 12_000,
    melody: [],
    audioPath
  }) as unknown as NoteMeta;

/** The screen's job, in miniature: remember which note was asked for. */
function OneCard({
  note,
  onTogglePlay,
  positionMs = 0
}: {
  note: NoteMeta;
  onTogglePlay?: (id: string) => void;
  positionMs?: number;
}) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  return (
    <NoteCard
      note={note}
      onOpen={jest.fn()}
      onDelete={jest.fn()}
      isPlaying={playingId === note.id}
      positionMs={playingId === note.id ? positionMs : 0}
      onTogglePlay={(id) => {
        onTogglePlay?.(id);
        setPlayingId((was) => (was === id ? null : id));
      }}
    />
  );
}

export const renderNoteCard = (
  note: NoteMeta,
  onTogglePlay?: (id: string) => void,
  positionMs = 0
) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <OneCard
            note={note}
            onTogglePlay={onTogglePlay}
            positionMs={positionMs}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
