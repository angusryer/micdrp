/**
 * Rendering a NoteCard under the providers it expects.
 *
 * `await waitFor(() => render(...))` before touching any query, matching
 * CaptureSection.test.tsx — a bare render leaves `screen` unbound here. Each
 * caller uses the returned queries rather than the shared `screen`.
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

export const renderNoteCard = (note: NoteMeta) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <NoteCard note={note} onOpen={jest.fn()} onDelete={jest.fn()} />
        </ThemeProvider>
      </I18nProvider>
    )
  );
