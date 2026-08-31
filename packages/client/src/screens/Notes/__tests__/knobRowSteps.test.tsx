/**
 * INV-NOTES-182 — both step sizes reach the panel, and mean what they say.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { TuningPanel } from '../TuningPanel';
import { coarseStep, fineStep } from '../../../analysis/knobSteps';
import { SEGMENT_KNOBS } from '../../../analysis/segmentSettings';
import { knobValue, resetKnobs } from '../../../analysis/readingValues';
import { READING_KNOBS } from '../../../analysis/knobOrder';

const HOLD = SEGMENT_KNOBS.find((k) => k.key === 'pitchHoldMs')!;
const shown = READING_KNOBS.find((k) => k.key === 'pitchHoldMs')!;

const open = () =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <TuningPanel onReread={jest.fn()} isReading={false} />
      </ThemeProvider>
    )
  );

beforeEach(() => {
  resetKnobs();
});

describe('turning a threshold', () => {
  it('moves by the small amount on the single mark', async () => {
    await open();
    const was = knobValue(shown);
    await fireEvent.press(screen.getByTestId('knob-pitchHoldMs-up'));
    expect(knobValue(shown)).toBe(was + fineStep(HOLD));
  });

  it('moves by the big amount on the double mark', async () => {
    await open();
    const was = knobValue(shown);
    await fireEvent.press(screen.getByTestId('knob-pitchHoldMs-up-coarse'));
    expect(knobValue(shown)).toBe(was + coarseStep(HOLD));
  });

  it('goes the other way too', async () => {
    await open();
    const was = knobValue(shown);
    await fireEvent.press(screen.getByTestId('knob-pitchHoldMs-down-coarse'));
    expect(knobValue(shown)).toBe(was - coarseStep(HOLD));
  });

  it('crosses the range in a handful of big presses, not thirty', async () => {
    await open();
    // What the two sizes exist for: the search half of the loop.
    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- one press at a time
      await fireEvent.press(screen.getByTestId('knob-pitchHoldMs-up-coarse'));
    }
    expect(knobValue(shown)).toBe(HOLD.max);
  });
});

/**
 * INV-NOTES-184 — a reading that did not happen says so.
 *
 * A failure was indistinguishable from a reading that changed nothing: the
 * control said it was working, stopped, and the graph stayed as it was.
 */
describe('when a reading could not happen', () => {
  it('says so beside the control it was asked for at', async () => {
    await waitFor(() =>
      render(
        <ThemeProvider>
          <TuningPanel
            onReread={jest.fn()}
            isReading={false}
            problem="Could not read this take — no audio to read."
          />
        </ThemeProvider>
      )
    );
    expect(screen.getByTestId('tuning-problem')).toBeTruthy();
  });

  it('says nothing when the reading worked', async () => {
    await open();
    expect(screen.queryByTestId('tuning-problem')).toBeNull();
  });
});
