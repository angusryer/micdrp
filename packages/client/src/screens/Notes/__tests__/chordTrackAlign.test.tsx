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
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { ChordSlot } from 'logic';

import { xForMs, type TimeAxis } from '../../../components/melodyScale';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { ChordTrack } from '../ChordTrack';

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

const renderTrack = (slots: readonly ChordSlot[] = SLOTS) =>
  render(
    <GestureHandlerRootView>
      <I18nProvider>
        <ThemeProvider>
          <ChordTrack
            slots={slots}
            timeAxis={AXIS}
            contentWidth={900}
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

  it('is as wide as the chord lasts', async () => {
    await renderTrack();
    const laid = placements();
    expect(laid[0].width).toBe(
      xForMs(AXIS, SLOTS[0].endMs) - xForMs(AXIS, SLOTS[0].startMs)
    );
  });

  it('stays tappable when a chord is too brief to be one', async () => {
    // 20ms at this scale is 4px, which no thumb can find.
    await renderTrack([slot(1, 500, 520)]);
    expect(placements()[0].width).toBeGreaterThanOrEqual(44);
  });

  it('draws nothing at all when the melody implied no chords', async () => {
    await renderTrack([]);
    expect(placements()).toHaveLength(0);
  });
});
