/**
 * The numbers under the marked frets — INV-NOTES-153.
 *
 * The dots were already there; what was missing was which fret each one is.
 * These read the labels back as text and as geometry: the right frets, no
 * others, each centred on the space its marker is centred on, and gone when
 * the neck is put away.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { NoteNeckSection } from '../NoteNeckSection';
import { layoutNeck, NECK_HEIGHT, NUMBERED_FRETS } from '../neckLayout';

const WIDTH = 340;
const GEOMETRY = layoutNeck({
  width: WIDTH,
  height: NECK_HEIGHT,
  strings: 6,
  frets: 12
});

/** G4 A4 B4, enough of a melody for the section to have something to draw. */
const MELODY = [
  { midi: 67, startMs: 0, endMs: 400 },
  { midi: 69, startMs: 500, endMs: 900 },
  { midi: 71, startMs: 1000, endMs: 1400 }
];

const draw = async (isShown = true) =>
  await render(
    <I18nProvider>
      <ThemeProvider>
        <NoteNeckSection
          melody={MELODY}
          width={WIDTH}
          isShown={isShown}
          onShown={jest.fn()}
        />
      </ThemeProvider>
    </I18nProvider>
  );

const testIDFor = (fret: number) => `neck-fret-number-${fret}`;

/** The label sits in a box of its own, so its middle is left + half a width. */
const centreOfLabel = (label: { props: Record<string, unknown> }) => {
  const box = StyleSheet.flatten(label.props.style as StyleProp<TextStyle>);
  return Number(box.left) + Number(box.width) / 2;
};

describe('INV-NOTES-153 — the marked frets say which fret they are', () => {
  it('numbers the frets a player counts by', async () => {
    // The set is the marked frets themselves, not a second list to drift.
    expect([...NUMBERED_FRETS]).toEqual([3, 5, 7, 9, 12]);
    const tree = await draw();
    NUMBERED_FRETS.forEach((fret) => {
      expect(tree.getByTestId(testIDFor(fret))).toHaveTextContent(String(fret));
    });
  });

  it('numbers no fret that carries no marker', async () => {
    const tree = await draw();
    for (let fret = 0; fret <= 12; fret += 1) {
      if (NUMBERED_FRETS.includes(fret)) continue;
      expect(tree.queryByTestId(testIDFor(fret))).toBeNull();
    }
  });

  it('centres each number on the space its marker is in', async () => {
    const tree = await draw();
    NUMBERED_FRETS.forEach((fret) => {
      expect(centreOfLabel(tree.getByTestId(testIDFor(fret)))).toBeCloseTo(
        GEOMETRY.centreOf(fret),
        5
      );
    });
  });

  it('takes the numbers away with the board', async () => {
    const away = await draw(false);
    NUMBERED_FRETS.forEach((fret) => {
      expect(away.queryByTestId(testIDFor(fret))).toBeNull();
    });
  });
});
