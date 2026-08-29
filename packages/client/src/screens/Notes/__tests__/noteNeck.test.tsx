/**
 * The neck under the graph — INV-NOTES-145, 148, 149, 150, 151.
 *
 * The maintainer's only requirement of the drawing was that it be followable
 * as a fretboard. That is not a matter of taste once it is written down: six
 * strings, a nut, twelve frets that narrow toward the body, and the markers a
 * player counts by. This checks the drawing carries them, and that what is
 * lit on it is what is sounding.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { skiaDrawn, type DrawnNode } from '../../../testing/skiaDrawn';
import { MARKER_RADIUS } from '../NeckBoard';
import { NoteNeckSection } from '../NoteNeckSection';
import { layoutNeck, MARKER_FRETS, NECK_HEIGHT } from '../neckLayout';
import { activePlace, placeMelody } from '../neckPlaces';

const WIDTH = 340;

const GEOMETRY = layoutNeck({
  width: WIDTH,
  height: NECK_HEIGHT,
  strings: 6,
  frets: 12
});

/** Skia primitives carry no testID, so the drawing is read as geometry. */
const ends = (line: DrawnNode) =>
  line.props as { p1: { x: number; y: number }; p2: { x: number; y: number } };
const isHorizontal = (line: DrawnNode) => ends(line).p1.y === ends(line).p2.y;
const isVertical = (line: DrawnNode) => ends(line).p1.x === ends(line).p2.x;
const radius = (circle: DrawnNode) => (circle.props as { r: number }).r;

const sung = (midi: number, startMs: number, endMs: number) => ({
  midi,
  startMs,
  endMs
});

/** G4 A4 B4 C5, a phrase that sits comfortably on the neck. */
const MELODY = [
  sung(67, 0, 400),
  sung(69, 500, 900),
  sung(71, 1000, 1400),
  sung(72, 1500, 2000)
];

// RNTL 14 renders asynchronously, so every one of these is awaited.
const draw = async (
  props: Partial<React.ComponentProps<typeof NoteNeckSection>> = {}
) =>
  await render(
    <I18nProvider>
      <ThemeProvider>
        <NoteNeckSection
          melody={MELODY}
          width={WIDTH}
          isShown
          onShown={props.onShown ?? jest.fn()}
          {...props}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('INV-NOTES-145 — the neck reads as a neck', () => {
  it('draws six strings and thirteen wires counting the nut', async () => {
    const lines = skiaDrawn(await draw(), 'Line');
    expect(lines.filter(isHorizontal)).toHaveLength(6);
    expect(lines.filter(isVertical)).toHaveLength(13);
  });

  it('narrows every fret space toward the body', () => {
    const spaces = GEOMETRY.fretXs
      .slice(1)
      .map((x, i) => x - GEOMETRY.fretXs[i]);
    spaces.slice(1).forEach((space, i) => {
      expect(space).toBeLessThan(spaces[i]);
    });
  });

  it('spaces the frets by the twelfth root of two, not evenly', () => {
    const { fretXs, nutX } = GEOMETRY;
    // The twelfth fret halves the string, so the drawn board is half a whole
    // scale and the last wire lands on the far edge of it.
    expect(fretXs[12]).toBeCloseTo(WIDTH, 5);
    // Evenly divided, the fifth wire would sit at five twelfths of the board.
    const scale = (WIDTH - nutX) * 2;
    expect(fretXs[5] - nutX).toBeCloseTo(scale * (1 - Math.pow(2, -5 / 12)), 5);
    expect(fretXs[5] - nutX).not.toBeCloseTo(((WIDTH - nutX) * 5) / 12, 1);
  });

  it('thickens the strings as they get lower', () => {
    // Index 0 is the lowest-sounding string, so it is the thickest.
    expect(GEOMETRY.stringWidths[0]).toBeGreaterThan(GEOMETRY.stringWidths[5]);
  });

  it('marks the frets a player counts by, doubled at the twelfth', async () => {
    const inlays = skiaDrawn(await draw(), 'Circle').filter(
      (circle) => radius(circle) === MARKER_RADIUS
    );
    const at = (fret: number) =>
      inlays.filter(
        (circle) =>
          Math.abs((circle.props as { cx: number }).cx - GEOMETRY.centreOf(fret))
          < 0.001
      );
    MARKER_FRETS.forEach((fret) => expect(at(fret)).toHaveLength(1));
    expect(at(12)).toHaveLength(2);
    expect(inlays).toHaveLength(MARKER_FRETS.length + 2);
  });
});

describe('INV-NOTES-148 — drawn the way tab is read', () => {
  it('puts the highest-sounding string at the top', () => {
    expect(GEOMETRY.stringYs[5]).toBeLessThan(GEOMETRY.stringYs[0]);
  });

  it('ascends the frets to the right of the nut', () => {
    expect(GEOMETRY.fretXs[1]).toBeGreaterThan(GEOMETRY.nutX);
    expect(GEOMETRY.centreOf(5)).toBeGreaterThan(GEOMETRY.centreOf(1));
  });

  it('marks an open string clear of the nut, on the far side', () => {
    expect(GEOMETRY.centreOf(0)).toBeLessThan(GEOMETRY.nutX);
  });
});

describe('INV-NOTES-149 — a place is lit exactly while its note sounds', () => {
  const placed = placeMelody(MELODY, GEOMETRY);

  it('lights the place of the note covering the moment', () => {
    expect(activePlace(placed.notes, 200)).toBe(0);
    expect(activePlace(placed.notes, 1200)).toBe(2);
  });

  it('lights the note at its own start and end', () => {
    expect(activePlace(placed.notes, 500)).toBe(1);
    expect(activePlace(placed.notes, 900)).toBe(1);
  });

  it('lights nothing between notes or before the first', () => {
    expect(activePlace(placed.notes, 450)).toBe(-1);
    expect(activePlace(placed.notes, -1)).toBe(-1);
    expect(activePlace(placed.notes, 9000)).toBe(-1);
  });
});

describe('INV-NOTES-150/151 — what is shown, and putting it away', () => {
  it('places the reading it was handed, note for note', () => {
    expect(placeMelody(MELODY, GEOMETRY).notes).toHaveLength(MELODY.length);
    expect(placeMelody(MELODY.slice(0, 2), GEOMETRY).notes).toHaveLength(2);
  });

  it('draws no board when it has been put away, but keeps the way back', async () => {
    const away = await draw({ isShown: false });
    expect(skiaDrawn(away, 'Line')).toHaveLength(0);
    expect(away.getByTestId('neck-toggle')).toBeTruthy();
  });

  it('asks to be put away when the control is pressed', async () => {
    const onShown = jest.fn();
    const tree = await draw({ onShown });
    await fireEvent.press(tree.getByTestId('neck-toggle'));
    expect(onShown).toHaveBeenCalledWith(false);
  });
});
