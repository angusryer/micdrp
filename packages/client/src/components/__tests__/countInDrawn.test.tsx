/**
 * INV-NOTES-252 — the count-in is drawn in front of the take.
 *
 * At the canvas, because the claim is that the drawing widens to the left
 * rather than the recording moving to make room. Every test below this
 * passes on a count-in that quietly shifted the take instead.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { skiaDrawn, type DrawnNode } from '../../testing/skiaDrawn';
import { TappedBeats } from '../TappedBeats';
import type { DrawnBeat } from 'logic';

/** One pixel per millisecond from two seconds before the take. */
const timeAxis = { t0: -2000, span: 6000, pad: 0, innerW: 6000, pxPerMs: 1 };

const LINE: DrawnBeat[] = [
  { atMs: 0, kind: 'tapped', isDownbeat: false },
  { atMs: 500, kind: 'tapped', isDownbeat: false }
];

/** A four-beat count at 120, ending where the take begins. */
const COUNT = [-2000, -1500, -1000, -500];

const draw = (countIn: number[], line: DrawnBeat[] = LINE) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <TappedBeats
          line={line}
          countIn={countIn}
          timeAxis={timeAxis}
          contentWidth={6000}
          height={200}
        />
      </ThemeProvider>
    </I18nProvider>
  );

const xs = (tree: unknown): number[] =>
  skiaDrawn(tree as never, 'Line').map(
    (mark: DrawnNode) => (mark.props.p1 as { x: number }).x
  );

describe('the count-in on the graph', () => {
  it('draws its beats before the take, and the take where it was', async () => {
    // t0 is -2000, so the count starts at x=0 and the take at x=2000.
    expect(xs(await draw(COUNT))).toEqual([0, 500, 1000, 1500, 2000, 2500]);
  });

  it('draws the take alone when there is no count', async () => {
    expect(xs(await draw([]))).toEqual([2000, 2500]);
  });

  it('tells a count beat from a beat of the take', async () => {
    const marks = skiaDrawn(await draw(COUNT), 'Line');
    const count = marks[0].props;
    const take = marks[COUNT.length].props;
    expect(count.color).not.toBe(take.color);
  });

  it('draws a count even where nothing of the take was tapped', async () => {
    expect(xs(await draw(COUNT, []))).toEqual([0, 500, 1000, 1500]);
  });
});
