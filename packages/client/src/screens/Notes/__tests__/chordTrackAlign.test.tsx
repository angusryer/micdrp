/**
 * INV-NOTES-061 — a chord card starts where its chord starts.
 *
 * The cards used to scroll in a row of their own, and two scroll positions
 * over one timeline agree only where they both begin: a card and the bar it
 * described drifted apart as soon as you moved along the take. What this pins
 * is that a card's left edge is the graph's own mapping of its chord's start,
 * not a position of the track's own devising.
 *
 * `render` is async in this setup — await it.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { ChordSlot } from 'logic';

import { xForMs, type TimeAxis } from '../../../components/melodyScale';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { ChordTrack, MIN_CARD_WIDTH } from '../ChordTrack';

const AXIS: TimeAxis = {
  t0: 500,
  span: 4000,
  pad: 12,
  innerW: 300,
  pxPerMs: 0.2
};

const slot = (bar: number, startMs: number, endMs: number): ChordSlot =>
  ({
    bar,
    label: 'C',
    roman: 'I',
    startMs,
    endMs,
    isEdited: false
  }) as ChordSlot;

const SLOTS = [
  slot(1, 500, 2500),
  slot(2, 2500, 4500)
];

const onReveal = jest.fn();

const renderTrack = (slots: readonly ChordSlot[] = SLOTS) =>
  render(
    <GestureHandlerRootView>
      <I18nProvider>
        <ThemeProvider>
          <ChordTrack
            slots={slots}
            timeAxis={AXIS}
            contentWidth={900}
            onReveal={onReveal}
            onNudge={jest.fn()}
            onReshape={jest.fn()}
            onAudition={jest.fn()}
            onRevert={jest.fn()}
          />
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );

/** Every positioned slot, in order, as the track laid them out. */
function placements(): Array<{ left: number; width: number }> {
  return screen
    .queryAllByTestId(/^chord-slot-/)
    .map((node) => Object.assign({}, ...(node.props.style as object[])));
}

describe('the chord track under the bars', () => {
  it('starts each card on its own downbeat', async () => {
    await renderTrack();
    const laid = placements();
    expect(laid).toHaveLength(SLOTS.length);
    // The axis's own mapping, not a second one that happens to agree today.
    expect(laid[0].left).toBe(xForMs(AXIS, SLOTS[0].startMs));
    expect(laid[1].left).toBe(xForMs(AXIS, SLOTS[1].startMs));
  });

  it('is as wide as the chord lasts, and never wider', async () => {
    await renderTrack();
    const laid = placements();
    laid.forEach((placed, i) => {
      expect(placed.width).toBe(
        xForMs(AXIS, SLOTS[i].endMs) - xForMs(AXIS, SLOTS[i].startMs)
      );
    });
  });

  it('INV-NOTES-063: marks a chord too narrow to be a card', async () => {
    // 20ms at this scale is 4px — no card fits, so nothing pretends one does.
    await renderTrack([slot(1, 500, 520)]);
    expect(placements()[0].width).toBeLessThan(MIN_CARD_WIDTH);
    expect(screen.queryByRole('button', { name: /too narrow/ })).not.toBeNull();
    expect(screen.queryAllByLabelText(/^C, bar \d+$/)).toHaveLength(0);
  });

  it('INV-NOTES-063: a mark asks for exactly enough zoom to become a card', async () => {
    onReveal.mockClear();
    await renderTrack([slot(1, 500, 520)]);
    await fireEvent.press(screen.getByRole('button', { name: /too narrow/ }));

    const [factor, focalX] = onReveal.mock.calls[0] as [number, number];
    const left = xForMs(AXIS, 500);
    const width = xForMs(AXIS, 520) - left;
    expect(width * factor).toBeCloseTo(MIN_CARD_WIDTH, 5);
    // Held about the mark itself, so the chord you tapped is what opens up.
    expect(focalX).toBeCloseTo(left + width / 2, 5);
  });

  it('a chord with room to spare is a card, not a mark', async () => {
    await renderTrack();
    expect(screen.queryByRole('button', { name: /too narrow/ })).toBeNull();
    expect(screen.queryAllByLabelText(/^C, bar \d+$/)).toHaveLength(SLOTS.length);
  });

  it('draws nothing at all when the melody implied no chords', async () => {
    await renderTrack([]);
    expect(placements()).toHaveLength(0);
  });
});

describe('INV-NOTES-103: the strip is its own ground, not a row of frames', () => {
  /** Flattened style of a node, however many pieces it was built from. */
  const styleOf = (node: { props: Record<string, unknown> }) => {
    const style = node.props.style;
    return Object.assign(
      {},
      ...(Array.isArray(style) ? (style as object[]) : [style as object])
    ) as Record<string, unknown>;
  };

  it('sits on a different ground from the drawing above it', async () => {
    await renderTrack();
    const strip = styleOf(screen.getByTestId('chord-strip'));
    expect(strip.backgroundColor).toBeTruthy();
  });

  it('is separated by one faint line rather than a rule', async () => {
    await renderTrack();
    const strip = styleOf(screen.getByTestId('chord-strip'));
    // Heavier than a hairline and it reads as a bar line, which is the one
    // thing a horizontal rule on a music graph must not look like.
    expect(strip.borderTopWidth).toBeLessThanOrEqual(1);
    expect(strip.borderTopWidth as number).toBeGreaterThan(0);
    expect(strip.borderTopColor).toBeTruthy();
  });

  it('draws no frame around a chord it simply read', async () => {
    await renderTrack();
    const card = styleOf(screen.getAllByLabelText(/C/)[0]);
    // The card's position already says which chord it is (INV-NOTES-061), so
    // a border around it spent width saying nothing — at exactly the scale
    // where width is what a chord is short of.
    expect(card.borderWidth ?? 0).toBe(0);
    expect(card.backgroundColor).toBe('transparent');
  });
});
