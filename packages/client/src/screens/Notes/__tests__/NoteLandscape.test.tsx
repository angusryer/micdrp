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

jest.mock('../NoteShapeSection', () => ({
  NoteShapeSection: ({ height }: { height: number }) => {
    shapeHeights.push(height);
    return null;
  }
}));
jest.mock('../SelectionBar', () => ({ SelectionBar: () => null }));
jest.mock('../ChordTrack', () => ({ ChordTrack: () => null }));

const detail = {
  chords: {
    slots: [{ label: 'C' }],
    nudge: jest.fn(),
    reshape: jest.fn(),
    revert: jest.fn()
  },
  auditionChord: jest.fn(),
  selection: null,
  setSelection: jest.fn()
} as never;

const renderSideways = () =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <NoteLandscape detail={detail} width={800} />
      </ThemeProvider>
    </I18nProvider>
  );

/** The slot the graph is given, which is the thing that reports its size. */
const slot = () => screen.getByTestId('graph-room');

describe('a note held sideways', () => {
  beforeEach(() => {
    shapeHeights.length = 0;
  });

  it('draws nothing until it knows how much room it has', async () => {
    await renderSideways();
    expect(shapeHeights).toEqual([]);
  });

  it('draws to the room the layout gave it', async () => {
    await renderSideways();

    await act(() =>
      slot().props.onLayout({ nativeEvent: { layout: { height: 260 } } })
    );
    // Its own border sits inside that room, so the drawing is that much less.
    expect(shapeHeights[shapeHeights.length - 1]).toBe(258);
  });

  it('gives way when there is less room, rather than overflowing', async () => {
    await renderSideways();

    await act(() =>
      slot().props.onLayout({ nativeEvent: { layout: { height: 260 } } })
    );
    const roomy = shapeHeights[shapeHeights.length - 1];
    // What happens when the options card appears and takes some of the column.
    await act(() =>
      slot().props.onLayout({ nativeEvent: { layout: { height: 180 } } })
    );
    const tight = shapeHeights[shapeHeights.length - 1];

    expect(tight).toBeLessThan(roomy);
  });
});
