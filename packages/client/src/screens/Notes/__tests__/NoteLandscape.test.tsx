/**
 * INV-NOTES-060 — sideways, the graph is measured, not predicted.
 *
 * The graph's height used to be the screen height minus a list of constants
 * for the things beside it. Every new row under the graph had to remember to
 * join that list, and the options card — which appears only once something is
 * chosen — never did, so choosing anything pushed the chord strip off the
 * bottom of a screen with no room to spare.
 *
 * What these pin is that the number comes from the layout: nothing is drawn
 * before the room is known, and what is drawn is the room that was given.
 *
 * `render` is async in this setup, as the interpretation suite notes — await
 * it, and await the act that reports a layout.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { NoteLandscape } from '../NoteLandscape';

const shapeHeights: number[] = [];
const shapeWidths: number[] = [];

jest.mock('../NoteShapeSection', () => ({
  // The floor is the section's to declare, so the mock has to carry it too.
  MIN_GRAPH_HEIGHT: 96,
  NoteShapeSection: ({ height, width }: { height: number; width: number }) => {
    shapeHeights.push(height);
    shapeWidths.push(width);
    return null;
  }
}));
jest.mock('../PlaybackBar', () => {
  const { View: Stub } = require('react-native');
  return { PlaybackBar: () => <Stub testID="transport" /> };
});
jest.mock('../SelectionPanel', () => {
  const { View: Stub } = require('react-native');
  return {
    SelectionPanel: ({ selection }: { selection: unknown[] }) =>
      selection.length > 0 ? <Stub testID="panel" /> : null
  };
});
jest.mock('../ChordTrack', () => ({ ChordTrack: () => null }));

const detail = {
  note: { audioPath: 'takes/one.m4a' } as { audioPath: string } | null,
  resolveAudio: jest.fn(),
  backdrop: { durationMs: 4000 },
  melodyVoiceMix: { durationMs: 4000 },
  chords: {
    slots: [{ label: 'C' }],
    nudge: jest.fn(),
    reshape: jest.fn(),
    revert: jest.fn()
  },
  auditionChord: jest.fn(),
  selection: [] as unknown[],
  setSelection: jest.fn()
};

const renderSideways = (over: Record<string, unknown> = {}) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <NoteLandscape detail={{ ...detail, ...over } as never} />
      </ThemeProvider>
    </I18nProvider>
  );

/** Report a layout for the graph's slot, as the real layout pass would. */
const layout = (width: number, height: number) =>
  act(() => slot().props.onLayout({ nativeEvent: { layout: { width, height } } }));

/** The slot the graph is given, which is the thing that reports its size. */
const slot = () => screen.getByTestId('graph-room');

describe('a note held sideways', () => {
  beforeEach(() => {
    shapeHeights.length = 0;
    shapeWidths.length = 0;
  });

  it('draws nothing until it knows how much room it has', async () => {
    await renderSideways();
    expect(shapeHeights).toEqual([]);
  });

  it('draws to the room the layout gave it', async () => {
    await renderSideways();

    await layout(700, 260);
    // All of it. There is no border to sit inside any more: the drawing runs
    // to the edges of the room it was given (INV-NOTES-101).
    expect(shapeHeights[shapeHeights.length - 1]).toBe(260);
    // Width comes from the same measurement now that the selection panel can
    // take some of it (INV-NOTES-099).
    expect(shapeWidths[shapeWidths.length - 1]).toBe(700);
  });

  it('INV-NOTES-062: can sound the take from where it is being looked at', async () => {
    await renderSideways();
    expect(screen.queryByTestId('transport')).not.toBeNull();
  });

  it('offers no transport for a note whose audio never arrived', async () => {
    await renderSideways({ note: null });
    expect(screen.queryByTestId('transport')).toBeNull();
  });

  it('gives way when there is less room, rather than overflowing', async () => {
    await renderSideways();

    await layout(700, 260);
    const roomy = shapeHeights[shapeHeights.length - 1];
    // What happens when something below it takes some of the column.
    await layout(700, 180);
    const tight = shapeHeights[shapeHeights.length - 1];

    expect(tight).toBeLessThan(roomy);
  });

  it('narrows rather than being covered when the panel takes its width', async () => {
    // The panel is a sibling in the row, so the slot itself is measured
    // smaller. Sideways there is no height to give up, which is why the
    // sheet that rises from the bottom is wrong here (INV-NOTES-099).
    await renderSideways();
    await layout(700, 260);
    const full = shapeWidths[shapeWidths.length - 1];
    await layout(430, 260);

    expect(shapeWidths[shapeWidths.length - 1]).toBeLessThan(full);
    expect(shapeHeights[shapeHeights.length - 1]).toBe(260);
  });

  it('offers the panel only once something is chosen', async () => {
    await renderSideways();
    expect(screen.queryByTestId('panel')).toBeNull();

    const chosen = await renderSideways({
      selection: [{ kind: 'melodyNote', index: 0 }]
    });
    expect(chosen.queryByTestId('panel')).not.toBeNull();
  });
});
