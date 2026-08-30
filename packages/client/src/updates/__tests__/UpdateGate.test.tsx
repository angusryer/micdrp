/**
 * The prompt's policy, through the component that owns it.
 *
 * `busy.test.ts` proves the primitives; this proves the gate actually consults
 * them. ACC-UPD-013 through ACC-UPD-018, and INV-UPD-004 — the rule that a
 * modal must never land over a live take.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import UpdateGate from '../UpdateGate';
import { resetDeferralsForTests } from '../apply';
import { markBusy, resetBusyForTests } from '../../app/activity';
import { checkForUpdate } from '../check';
import { downloadBundle } from '../download';
import { stagedBundle } from '../bundle';

jest.mock('../check', () => ({ checkForUpdate: jest.fn() }));
jest.mock('../bundle', () => ({ stagedBundle: jest.fn(() => null) }));
jest.mock('../download', () => ({ downloadBundle: jest.fn() }));
jest.mock('../rollback', () => ({ rollBack: jest.fn(() => Promise.resolve(true)) }));

const checkMock = checkForUpdate as jest.MockedFunction<typeof checkForUpdate>;
const downloadMock = downloadBundle as jest.MockedFunction<typeof downloadBundle>;
const stagedMock = stagedBundle as jest.MockedFunction<typeof stagedBundle>;

const anOffer = {
  decision: 'update' as const,
  bundleId: 'b2',
  fileUrl: 'https://ota.example.com/b2.zip',
  fileHash: 'abc'
};

/**
 * The gate reads the theme and the string table, and both come from providers
 * the app mounts above it. `await waitFor(() => render(...))` before touching
 * `screen` matches PlaybackBar.test.tsx — a bare render leaves `screen`
 * unbound in this setup.
 */
const renderGate = () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <UpdateGate />
        </ThemeProvider>
      </I18nProvider>
    )
  );

const nothing = {
  decision: 'none' as const,
  bundleId: null,
  fileUrl: null,
  fileHash: null
};

beforeEach(() => {
  stagedMock.mockReset().mockReturnValue(null);
  resetBusyForTests();
  resetDeferralsForTests();
  checkMock.mockReset().mockResolvedValue(anOffer);
  // Mirror the real contract rather than staging unconditionally: there is
  // nothing to fetch when nothing was offered, and a mock that ignores that
  // would mock away the very guard these tests are checking.
  downloadMock
    .mockReset()
    .mockImplementation(async (result) =>
      result.decision === 'update' && result.bundleId
        ? { bundleId: result.bundleId }
        : null
    );
});

describe('UpdateGate', () => {
  it('ACC-UPD-013: a downloaded bundle asks the singer', async () => {
    await renderGate();
    expect(await screen.findByText('An update is ready.')).toBeTruthy();
    expect(screen.getByText('Restart now')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
  });

  it('ACC-UPD-009: nothing on offer shows nothing', async () => {
    checkMock.mockResolvedValue(nothing);
    await renderGate();
    await waitFor(() => expect(checkMock).toHaveBeenCalled());
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });

  it('ACC-UPD-012: a bundle that failed to stage shows nothing', async () => {
    downloadMock.mockResolvedValue(null);
    await renderGate();
    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });

  it('ACC-UPD-014: a capture in progress holds the prompt back', async () => {
    markBusy('capture');
    await renderGate();
    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });

  it('ACC-UPD-015: a practice session holds the prompt back', async () => {
    markBusy('practice session');
    await renderGate();
    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });

  it('ACC-UPD-016: the prompt appears once the take ends, not lost', async () => {
    const done = markBusy('capture');
    await renderGate();
    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    expect(screen.queryByText('An update is ready.')).toBeNull();

    done();
    expect(await screen.findByText('An update is ready.')).toBeTruthy();
  });

  it('ACC-UPD-018: a bundle already deferred does not ask again', async () => {
    const first = await renderGate();
    await fireEvent.press(await screen.findByText('Later'));
    await first.unmount();

    await renderGate();
    await waitFor(() => expect(checkMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });
});


/**
 * INV-UPD-023 — a bundle staged by an earlier session keeps asking.
 *
 * The prompt was only ever raised by a download completing, so a bundle left
 * unanswered was never mentioned again. Nothing else could raise it: the check
 * reports a staged bundle as the one running, so the server rightly answers
 * that there is nothing newer.
 */
describe('a bundle already waiting', () => {
  it('is offered on launch, without asking the server', async () => {
    stagedMock.mockReturnValue('b9');
    await renderGate();
    await waitFor(() => {
      expect(screen.getByText('An update is ready.')).toBeTruthy();
    });
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('stops being offered once it has been put off', async () => {
    stagedMock.mockReturnValue('b9');
    await renderGate();
    await waitFor(() => {
      expect(screen.getByText('An update is ready.')).toBeTruthy();
    });
    await fireEvent.press(screen.getByText('Later'));
    await waitFor(() => {
      expect(screen.queryByText('An update is ready.')).toBeNull();
    });
  });

  it('asks the server when nothing is waiting', async () => {
    checkMock.mockResolvedValue(nothing);
    await renderGate();
    await waitFor(() => {
      expect(checkMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('An update is ready.')).toBeNull();
  });
});
