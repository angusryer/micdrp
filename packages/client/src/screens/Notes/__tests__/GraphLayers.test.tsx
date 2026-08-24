/**
 * INV-NOTES-104 — one set of downbeat positions, not two.
 *
 * The drawn line and the touch target used to be worked out independently.
 * Both were plausible; they disagreed by the length of the pickup, because
 * only one of them knew there was a pickup. Nothing could catch that, since
 * each was correct against its own arithmetic.
 *
 * So what is pinned here is not a number. It is that the layer that paints
 * and the layer that listens are handed the same array.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { GraphLayers } from '../GraphLayers';
import type { BarHandle } from '../barRulerModel';

const painted: (readonly BarHandle[])[] = [];
const listened: (readonly BarHandle[])[] = [];

jest.mock('../BarRuler', () => ({
  BarRuler: (props: { handles: readonly unknown[] }) => {
    painted.push(props.handles as readonly BarHandle[]);
    return null;
  }
}));
jest.mock('../../../components/GraphSurface', () => ({
  GraphSurface: (props: { bars: readonly unknown[] }) => {
    listened.push(props.bars as readonly BarHandle[]);
    return null;
  }
}));
jest.mock('../../../components/ChordBand', () => ({ ChordBand: () => null }));
jest.mock('../../../components/SelectionGlow', () => ({
  SelectionGlow: () => null
}));

const detail = {
  gridForView: {
    bpm: 120,
    // A pickup: the first downbeat is a second and a half into the take.
    offsetMs: 1500,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    barSteps: [0, 16, 32]
  },
  chords: { slots: [], moveTone: jest.fn() },
  floorMidi: 48,
  bars: { layout: { lines: [0, 16, 32] }, move: jest.fn(), split: jest.fn() },
  correctNote: jest.fn(),
  hearDragged: jest.fn(),
  hits: []
};

const timeAxis = { t0: 0, span: 12_000, pad: 12, innerW: 900, pxPerMs: 0.2 };
const pitchAxis = { lane: 8, floor: 48, ceiling: 72 };

const draw = () =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <GraphLayers
          detail={detail as never}
          noteRects={[]}
          contentWidth={900}
          height={200}
          timeAxis={timeAxis as never}
          pitchAxis={pitchAxis as never}
          selection={[]}
          onSelect={jest.fn()}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the layers over the melody', () => {
  beforeEach(() => {
    painted.length = 0;
    listened.length = 0;
  });

  it('hands the drawn lines and the touched lines the same array', async () => {
    await draw();
    expect(painted[painted.length - 1]).toBe(listened[listened.length - 1]);
  });

  it('places them past the pickup, where the downbeats actually are', async () => {
    await draw();
    const [first] = painted[painted.length - 1];
    // Step zero of the arrangement is the first downbeat, which is offsetMs
    // into the take — not the start of the recording.
    expect(first.x).toBeCloseTo(timeAxis.pad + 1500 * timeAxis.pxPerMs, 6);
  });
});
