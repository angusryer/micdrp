/**
 * INV-NOTES-246 — a note written in is drawn as written, not as sung.
 *
 * At the canvas, because that is where the claim is actually made. Every
 * test below this level passes on a written note filled in exactly like a
 * sung one, which is the state that would let a person come back to a take
 * and take the app's word that they sang something they wrote.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { skiaDrawn, type DrawnNode } from '../../testing/skiaDrawn';
import { MelodyView } from '../MelodyView';
import type { MelodyNote } from '../melodyLayout';

const GRID = { bpm: 120, offsetMs: 0, beatsPerBar: 4, stepsPerBeat: 4 };

const NOTES: MelodyNote[] = [
  { midi: 60, startMs: 0, endMs: 500 },
  { midi: 64, startMs: 500, endMs: 700, isWritten: true },
  { midi: 67, startMs: 1000, endMs: 1500 }
];

const draw = (notes: MelodyNote[]) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <MelodyView
          notes={notes}
          width={600}
          height={200}
          grid={GRID}
          beatWidth={60}
          fromMs={0}
        />
      </ThemeProvider>
    </I18nProvider>
  );

/** The note bars, which are the only rounded rects with a real width. */
const bars = (tree: unknown): DrawnNode[] =>
  skiaDrawn(tree as never, 'RoundedRect');

describe('a note written into a take', () => {
  it('is outlined where a sung note is filled', async () => {
    const drawn = bars(await draw(NOTES));
    expect(drawn).toHaveLength(3);
    const styles = drawn.map((r) => r.props.style);
    expect(styles[1]).toBe('stroke');
    expect(styles[0]).not.toBe('stroke');
    expect(styles[2]).not.toBe('stroke');
  });

  it('is drawn at its own moment and pitch like any other', async () => {
    const drawn = bars(await draw(NOTES));
    const xs = drawn.map((r) => r.props.x as number);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('draws a take with nothing written entirely filled', async () => {
    const plain = NOTES.map(({ isWritten: _drop, ...rest }) => rest);
    const drawn = bars(await draw(plain));
    expect(drawn.every((r) => r.props.style !== 'stroke')).toBe(true);
  });
});
