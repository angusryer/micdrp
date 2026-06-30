/**
 * i18n initialisation tests.
 *
 * Verifies that the i18next instance is synchronously initialised, that known
 * keys resolve to their English strings, and that the device-locale detection
 * falls back gracefully to 'en' when no matching locale is found.
 *
 * react-native-localize is mocked in jest.setup.js to return 'en-US'.
 */

import i18n, { I18nProvider } from '../index';

describe('i18n initialisation', () => {
  it('is initialised synchronously before the test runs', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('resolves known key record.title to its English string', () => {
    expect(i18n.t('record.title')).toBe('Sing');
  });

  it('resolves record.titleListening', () => {
    expect(i18n.t('record.titleListening')).toBe('Listening…');
  });

  it('resolves record.record', () => {
    expect(i18n.t('record.record')).toBe('Record');
  });

  it('resolves record.stop', () => {
    expect(i18n.t('record.stop')).toBe('Stop');
  });

  it('resolves notes.title', () => {
    expect(i18n.t('notes.title')).toBe('Notes');
  });

  it('resolves notes.emptyTitle', () => {
    expect(i18n.t('notes.emptyTitle')).toBe('No notes yet');
  });

  it('resolves dashboard.title', () => {
    expect(i18n.t('dashboard.title')).toBe('Dashboard');
  });

  it('resolves account.title', () => {
    expect(i18n.t('account.title')).toBe('Account & Settings');
  });

  it('resolves settings.analysis.vocabulary', () => {
    expect(i18n.t('settings.analysis.vocabulary')).toBe('Chords');
  });

  it('resolves settings.title', () => {
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it('resolves auth.signIn', () => {
    expect(i18n.t('auth.signIn')).toBe('Sign In');
  });

  it('resolves results.title', () => {
    expect(i18n.t('results.title')).toBe('Results');
  });

  it('resolves common.cancel', () => {
    expect(i18n.t('common.cancel')).toBe('Cancel');
  });

  it('resolves settings.engine.resetToDefaults', () => {
    expect(i18n.t('settings.engine.resetToDefaults')).toBe('Reset to defaults');
  });

  it('returns the key itself for an unknown key (i18next default behaviour)', () => {
    // i18next returns the key as a fallback when it cannot resolve the value.
    expect(i18n.t('nonexistent.key.that.does.not.exist')).toBe(
      'nonexistent.key.that.does.not.exist'
    );
  });

  it('active language is en (mocked localize returns en-US)', () => {
    expect(i18n.language).toBe('en');
  });
});

describe('I18nProvider export', () => {
  it('is a function (React component)', () => {
    expect(typeof I18nProvider).toBe('function');
  });
});
