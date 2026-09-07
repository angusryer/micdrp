/**
 * INV-NOTES-180 — tuning the reading happens in sight of what it changes.
 *
 * It was a full-screen page, so turning a threshold and seeing what the
 * threshold did were two acts with a dismissal between them. The whole point
 * of exposing the knobs is a loop — turn one, read again, look — and the loop
 * cannot be run through something covering the thing being looked at.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { NoteDetailsPage } from '../NoteDetailsPage';
import type { useNoteDetail } from '../useNoteDetail';

const fakeDetail = () =>
  ({
    note: {
      id: 'n1',
      title: 'A tune',
      durationMs: 8000,
      melody: [],
      createdAt: '2026-08-31T00:00:00Z'
    },
    melody: [],
    grid: { bpm: 120, beatsPerBar: 4, stepsPerBeat: 4, offsetMs: 0 },
    hasGrid: true,
    chords: { slots: [] },
    // The pickup is set from here now, so the page asks the bars for it.
    bars: {
      pickup: 0,
      setPickup: jest.fn(),
      layout: { lines: [0, 16], stepsPerBeat: 4, isCompound: false }
    },
    bpm: 120,
    readBpm: 120,
    isBpmByHand: false,
    setBpm: jest.fn(),
    isStale: false,
    reread: jest.fn(() => Promise.resolve()),
    playNote: jest.fn(),
    midiUri: null
  }) as unknown as ReturnType<typeof useNoteDetail>;

const open = () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <NoteDetailsPage
            detail={fakeDetail()}
            isOpen
            onClose={jest.fn()}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );

/** What the sheet was asked to be — its height and its dimming. */
const sheetProps = () =>
  (
    globalThis as unknown as {
      TRUE_SHEET_PROPS: Record<
        string,
        { detents: (number | string)[]; dimmed?: boolean }
      >;
    }
  ).TRUE_SHEET_PROPS['note-analysis'];

describe('the analysis sheet', () => {
  it('opens part way rather than over the whole screen', async () => {
    await open();
    const first = sheetProps().detents[0];
    expect(typeof first).toBe('number');
    expect(first as number).toBeLessThan(0.5);
  });

  it('can be dragged taller than it opens', async () => {
    await open();
    const { detents } = sheetProps();
    expect(detents.length).toBeGreaterThan(1);
    expect(detents[detents.length - 1] as number).toBeGreaterThan(
      detents[0] as number
    );
  });

  it('leaves the graph behind it undimmed, which is the point', async () => {
    // Dimming would hide the very change being watched for.
    await open();
    expect(sheetProps().dimmed).toBe(false);
  });

  it('still holds the control the loop is run from', async () => {
    await open();
    // Twice: the tuning panel's, and the stale-reading card's below it.
    expect(screen.getAllByText('Read it again').length).toBeGreaterThan(0);
  });
});

/**
 * ACC-NOTES-236 / INV-NOTES-222 — what moves the bar lines comes first.
 *
 * The sheet opens part way over the graph so the lines can be watched
 * moving as these change (INV-NOTES-078). What moves them belongs where it
 * is reachable without scrolling past what does not; the key, range and
 * chord count are read once and then left alone.
 *
 * Read off the source rather than the tree, because the order is a fact
 * about the page and a rendered sheet only shows what fits.
 */
describe('ACC-NOTES-236: the order of the sheet', () => {
  const source = readFileSync(
    join(__dirname, '..', 'NoteDetailsPage.tsx'),
    'utf8'
  );
  const at = (name: string) => source.indexOf(`<${name}`);

  it('opens on the tempo, the pickup and the tap pattern', () => {
    expect(at('TempoRow')).toBeGreaterThan(0);
    expect(at('TempoRow')).toBeLessThan(at('PickupRow'));
    expect(at('PickupRow')).toBeLessThan(at('TapPatternRow'));
  });

  it('puts the measured summary under them', () => {
    expect(at('TapPatternRow')).toBeLessThan(at('NoteStats'));
  });

  it('leaves the knobs below both', () => {
    // A long list to scroll past on the way to a stepper.
    expect(at('NoteStats')).toBeLessThan(at('TuningPanel'));
  });

  it('keeps re-reading last, because it replaces everything above it', () => {
    expect(at('TuningPanel')).toBeLessThan(at('RereadCard'));
  });
});
