/**
 * INV-NOTES-100 — the playhead runs the height of the graph, over the notes.
 *
 * The scrubber's handle sits in a band above the drawing so it never covers
 * what it points at (INV-NOTES-081), but a mark only in that band answers
 * "where am I" for the top edge and leaves the eye to guess the rest.
 *
 * It takes no touches. It crosses every note in the take, and a line that
 * swallowed touches would make the notes under it unpickable.
 *
 * Where it sits is `headPlacement`, computed on the UI thread every frame
 * (INV-NOTES-136) — so that is checked as the mapping it is, and what is
 * checked here is the layer it is drawn in.
 */
import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { render, screen } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { Playhead } from '../Playhead';
import { headPlacement } from '../playheadPlacement';
import type { TimeAxis } from '../../../components/melodyScale';

const AXIS: TimeAxis = {
  t0: 0,
  span: 4000,
  pad: 8,
  innerW: 400,
  pxPerMs: 0.1
};

/** A shared value without a component to own one. */
const held = (value: number) => ({ value }) as SharedValue<number>;

const at = (positionMs: number, axis: TimeAxis = AXIS) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <Playhead
          positionMs={held(positionMs)}
          timeAxis={axis}
          contentWidth={420}
          height={180}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the playhead', () => {
  it('runs the whole height of the graph', async () => {
    await at(2000);
    const line = screen.getByTestId('playhead').props.children;
    expect(screen.getByTestId('playhead')).not.toBeNull();
    // Its own layer is the full graph, and the line inside it is too.
    const style = Array.isArray(line.props.style)
      ? Object.assign({}, ...line.props.style)
      : line.props.style;
    expect(style.height).toBe(180);
  });

  it('takes no touches from the notes it crosses', async () => {
    await at(2000);
    expect(screen.getByTestId('playhead').props.pointerEvents).toBe('none');
  });

  it('draws nothing where there is no scale to place it on', async () => {
    await at(1000, { ...AXIS, pxPerMs: 0 });
    expect(screen.queryByTestId('playhead')).toBeNull();
  });
});

describe('where the head sits', () => {
  it('places it where the moment falls on the axis', () => {
    // The same mapping xForMs does, stated once so the worklet and the rest
    // of the drawing cannot disagree.
    expect(headPlacement(AXIS, 2000).translateX).toBe(208);
  });

  it('shows it while the moment is on the graph', () => {
    expect(headPlacement(AXIS, 2000).opacity).toBeGreaterThan(0);
  });

  it('hides it before the graph begins rather than parking it at the edge', () => {
    // A line held at the edge would claim the take is there.
    expect(headPlacement(AXIS, -500).opacity).toBe(0);
  });

  it('hides it past the end of the take', () => {
    expect(headPlacement(AXIS, 9000).opacity).toBe(0);
  });

  it('hides it where there is no scale to place it on', () => {
    expect(headPlacement({ ...AXIS, pxPerMs: 0 }, 1000).opacity).toBe(0);
  });
});
