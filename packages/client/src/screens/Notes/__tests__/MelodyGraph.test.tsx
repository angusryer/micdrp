/**
 * How the graph stacks — INV-NOTES-029.
 *
 * The maintainer asked for the chords under the melody and above the cards
 * that edit them, which is an ordering claim and nothing else: these pin the
 * order the two lanes are drawn in, so a later refactor cannot quietly put the
 * harmony back on top of the line it is supporting.
 *
 * `await waitFor(() => render(...))` before touching any query, matching the
 * other Notes tests — a bare render leaves `screen` unbound in this setup.
 */
import { render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';

import type { ChordSlot } from 'logic';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { MelodyGraph } from '../MelodyGraph';

const NOTES = [
  { midi: 60, startMs: 0, endMs: 1000 },
  { midi: 64, startMs: 1000, endMs: 2000 },
  { midi: 67, startMs: 2000, endMs: 4000 }
];

const slot = (bar: number, startMs: number, endMs: number): ChordSlot =>
  ({
    bar,
    startMs,
    endMs,
    rootPc: 0,
    quality: 'maj',
    label: 'C',
    roman: 'I',
    confidence: 1,
    isEdited: false
  }) as unknown as ChordSlot;

const SLOTS = [slot(1, 0, 2000), slot(2, 2000, 4000)];

const BARS = {
  layout: { lines: [0, 16], stepsPerBeat: 4, isCompound: false },
  totalSteps: 32,
  move: jest.fn(),
  split: jest.fn(),
  merge: jest.fn(),
  isArranged: false
};

const GRID = { bpm: 120, offsetMs: 0, beatsPerBar: 4, stepsPerBeat: 4 };

async function renderGraph(slots: readonly ChordSlot[] = SLOTS) {
  return waitFor(() =>
    render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <I18nProvider>
            <MelodyGraph
              notes={NOTES}
              slots={slots}
              bars={BARS}
              grid={GRID}
              width={300}
            />
          </I18nProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    )
  );
}

interface Node {
  props?: { testID?: string };
  children?: Node[] | null;
}

/** The graph itself, wherever the providers wrapping it have put it. */
function findGraph(node: Node | null): Node | null {
  if (!node) {
    return null;
  }
  if (node.props?.testID === 'melody-graph') {
    return node;
  }
  for (const child of node.children ?? []) {
    const hit = findGraph(child);
    if (hit) {
      return hit;
    }
  }
  return null;
}

describe('MelodyGraph', () => {
  it('draws the chord lane below the melody, as the last thing in the graph', async () => {
    const view = await renderGraph();
    const graph = findGraph(view.toJSON() as Node);
    const lanes = (graph?.children ?? []).map((c) => c.props?.testID);
    expect(lanes).toEqual(['graph-melody', 'chord-lane']);
  });

  it('shows one band per chord read from the take', async () => {
    const view = await renderGraph();
    expect(view.getByTestId('chord-band-0')).toBeTruthy();
    expect(view.getByTestId('chord-band-1')).toBeTruthy();
  });

  it('leaves the graph as it was when the take implied no chords', async () => {
    const view = await renderGraph([]);
    expect(view.queryByTestId('chord-lane')).toBeNull();
  });
});
