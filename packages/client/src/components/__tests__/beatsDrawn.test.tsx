/**
 * That a beat nobody tapped is drawn as one — INV-NOTES-237, at the level
 * where it is really true.
 *
 * The arithmetic is pinned in logic/beatAnchors. This pins that the
 * distinction reaches the canvas, which is the only place it matters: the
 * whole licence for filling a gap between two taps is that the fill is
 * visibly the app's guess sitting beside the person's statement
 * (INV-NOTES-200). A fill drawn identically to a tap would be the thing
 * that invariant was written to forbid, and every test below the canvas
 * would still pass.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { skiaDrawn, type DrawnNode } from '../../testing/skiaDrawn';
import { TappedBeats } from '../TappedBeats';
import type { DrawnBeat } from 'logic';

const timeAxis = { t0: 0, span: 4000, pad: 12, innerW: 900, pxPerMs: 0.2 };

const HEIGHT = 200;

const LINE: DrawnBeat[] = [
  { atMs: 0, kind: 'tapped', isDownbeat: false },
  { atMs: 600, kind: 'derived', isDownbeat: false },
  { atMs: 1200, kind: 'voiced', isDownbeat: false }
];

/** A drawn line's endpoints and weight, off the recorder's loose props. */
const at = (mark: DrawnNode) => ({
  x: (mark.props.p1 as { x: number }).x,
  top: (mark.props.p1 as { y: number }).y,
  bottom: (mark.props.p2 as { y: number }).y,
  opacity: mark.props.opacity as number,
  colour: mark.props.color as string
});

const draw = (line: DrawnBeat[]) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <TappedBeats
          line={line}
          timeAxis={timeAxis}
          contentWidth={900}
          height={HEIGHT}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the beats drawn over the melody', () => {
  it('draws a worked-out beat fainter than a tapped one', async () => {
    const lines = skiaDrawn(await draw(LINE), 'Line');
    expect(lines).toHaveLength(3);
    const [stated, derived] = lines.map(at);
    expect(derived.opacity).toBeLessThan(stated.opacity);
  });

  it('draws a worked-out beat shorter than a tapped one', async () => {
    const lines = skiaDrawn(await draw(LINE), 'Line');
    const span = (mark: DrawnNode) => at(mark).bottom - at(mark).top;
    expect(span(lines[1])).toBeLessThan(span(lines[0]));
  });

  it('draws every beat, tapped or not, at its own moment', async () => {
    const lines = skiaDrawn(await draw(LINE), 'Line');
    expect(lines.map((mark) => at(mark).x)).toEqual([12, 132, 252]);
  });

  it('draws a beat heard in the take in a colour of its own', async () => {
    // INV-NOTES-242. Both are things the person did, so both are drawn full
    // strength — but the graph must never claim a sung beat was tapped.
    const [tapped, , voiced] = skiaDrawn(await draw(LINE), 'Line').map(at);
    expect(voiced.colour).not.toBe(tapped.colour);
    expect(voiced.opacity).toBe(tapped.opacity);
  });

  it('draws all three kinds differently from each other', async () => {
    const marks = skiaDrawn(await draw(LINE), 'Line').map(at);
    const looks = marks.map((m) => `${m.colour}/${m.opacity}`);
    expect(new Set(looks).size).toBe(3);
  });

  it('draws nothing at all for a take with no beats', async () => {
    expect(skiaDrawn(await draw([]), 'Line')).toHaveLength(0);
  });
});
