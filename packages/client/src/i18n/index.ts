/**
 * i18n — internationalization infrastructure.
 *
 * Initialises i18next synchronously so that the I18nProvider can mount in the
 * root providers tree before any screen renders. Device locale is detected via
 * react-native-localize; the fallback language is always 'en'.
 *
 * Exports:
 *   - I18nProvider  — wraps I18nextProvider; mount once in AppProviders.
 *   - useTranslation — re-export from react-i18next so screens import from here.
 */

import React from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { findBestLanguageTag } from 'react-native-localize';

import en from './locales/en.json';

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

const resources = {
  en: { translation: en }
};

// ---------------------------------------------------------------------------
// Device-locale detection
// ---------------------------------------------------------------------------

/**
 * Resolve the best supported language tag for the current device locale.
 * Falls back to 'en' if react-native-localize finds no supported match.
 */
function detectLocale(): string {
  const supported = Object.keys(resources);
  const result = findBestLanguageTag(supported);
  return result?.languageTag ?? 'en';
}

// ---------------------------------------------------------------------------
// Synchronous initialisation
// ---------------------------------------------------------------------------
//
// `initReactI18next` handles the `use()` chain; `resources` are bundled so
// there is no async loading step. `initImmediate: false` ensures the init
// completes synchronously, so the provider is ready before the first render.

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLocale(),
    fallbackLng: 'en',
    interpolation: {
      // React already escapes values; no need for i18next escaping.
      escapeValue: false
    },
    // No async loading — resources are imported at build time.
    initImmediate: false
  });

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface I18nProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app in I18nextProvider with the already-initialised instance.
 * Mount inside AppProviders (before any screen or navigator).
 */
export function I18nProvider({ children }: I18nProviderProps): React.JSX.Element {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

// ---------------------------------------------------------------------------
// Re-exports consumed by screens
// ---------------------------------------------------------------------------

export { useTranslation };

export default i18n;
