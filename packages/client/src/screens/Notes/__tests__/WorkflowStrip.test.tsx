/**
 * INV-NOTES-267 — the take names its next step and carries its control.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { WorkflowStrip } from '../WorkflowStrip';
import type { WorkflowStep } from 'logic';

const show = async (step: WorkflowStep, over: Partial<React.ComponentProps<typeof WorkflowStrip>> = {}) => {
  const onRecord = jest.fn();
  const onChords = jest.fn();
  await render(
    <I18nProvider>
      <ThemeProvider>
        <WorkflowStrip
          step={step}
          countIn={{ onPlay: jest.fn(), onStop: jest.fn(), atMs: () => 0, onMake: jest.fn() }}
          isRecording={false}
          onRecord={onRecord}
          onChords={onChords}
          {...over}
        />
      </ThemeProvider>
    </I18nProvider>
  );
  return { onRecord, onChords };
};

describe('the workflow strip', () => {
  it('names the count-in first and carries its control', async () => {
    await show('count-in');
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByTestId('pickup-begin')).toBeTruthy();
  });

  it('names the bassline second and records it from here', async () => {
    const { onRecord } = await show('bassline');
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('workflow-record-bass'));
    });
    expect(onRecord).toHaveBeenCalled();
  });

  it('offers to stop while the bassline is being recorded', async () => {
    await show('bassline', { isRecording: true });
    expect(screen.getByText('Stop')).toBeTruthy();
  });

  it('names the chords third and reads them from here', async () => {
    const { onChords } = await show('chords');
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('workflow-read-chords'));
    });
    expect(onChords).toHaveBeenCalled();
  });

  it('shows nothing when the take has everything', async () => {
    await show('done');
    expect(screen.queryByTestId('workflow-strip')).toBeNull();
  });

  it('offers correcting beside every step, and gates none', async () => {
    for (const step of ['count-in', 'bassline', 'chords'] as const) {
      await show(step);
      expect(screen.getAllByText(/Fix any notes or beats/).length).toBeGreaterThan(0);
    }
  });
});
