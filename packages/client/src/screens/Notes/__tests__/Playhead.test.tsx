/**
 * INV-NOTES-100 — the playhead runs the height of the graph, over the notes.
 *
 * The scrubber's handle sits in a band above the drawing so it never covers
 * what it points at (INV-NOTES-081), but a mark only in that band answers
 * "where am I" for the top edge and leaves the eye to guess the rest.
 *
 * It takes no touches. It crosses every note in the take, and a line that
 * swallowed touches would make the notes under it unpickable.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { Playhead } from '../Playhead';
import type { TimeAxis } from '../../../components/melodyScale';

const AXIS: TimeAxis = {
  t0: 0,
  span: 4000,
  pad: 8,
  innerW: 400,
  pxPerMs: 0.1
};

const at = (positionMs: number, axis: TimeAxis = AXIS) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <Playhead
          positionMs={positionMs}
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

  it('marks nothing when the take has not reached the graph', async () => {
    await at(-500);
    expect(screen.queryByTestId('playhead')).toBeNull();
  });

  it('marks nothing past the end of the take', async () => {
    await at(9000);
    expect(screen.queryByTestId('playhead')).toBeNull();
  });

  it('draws nothing where there is no scale to place it on', async () => {
    await at(1000, { ...AXIS, pxPerMs: 0 });
    expect(screen.queryByTestId('playhead')).toBeNull();
  });
});
