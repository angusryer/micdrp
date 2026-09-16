/**
 * When renewal runs (INV-ACCOUNT-021): on launch, on returning to the
 * foreground, and before any request whose access token is about to expire.
 *
 * No timer. A phone suspends timers with the app, so a request made after a
 * long suspension would still find a stale token; checking at the request is
 * the only place that is always on time.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { backend } from '../lib/backend';
import { isSessionRoute, renewIfStale } from './renewSession';

/** A request goes out with at least this long left on its token. */
const REQUEST_MARGIN_SEC = 60;
/** Coming back to the app renews anything this close to expiring. */
const FOREGROUND_MARGIN_SEC = 600;

type Headers = Record<string, string>;

/** Renew before sending, then carry whatever token is now current. */
async function renewBeforeSend(
  url: string,
  options: { headers?: Headers }
): Promise<{ url: string; options: { headers?: Headers } }> {
  if (isSessionRoute(url)) {
    return { url, options };
  }
  await renewIfStale(REQUEST_MARGIN_SEC);
  const headers: Headers = { ...options.headers };
  const token = backend.authStore.token;
  if (token) {
    headers.Authorization = token;
  } else {
    delete headers.Authorization;
  }
  return { url, options: { ...options, headers } };
}

/** Keep the session renewed once the stored session has been read. */
export function useSessionRenewal(ready: boolean): void {
  useEffect(() => {
    if (!ready) {
      return;
    }
    backend.beforeSend = renewBeforeSend;
    void renewIfStale(FOREGROUND_MARGIN_SEC);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void renewIfStale(FOREGROUND_MARGIN_SEC);
      }
    });
    return () => {
      subscription.remove();
      backend.beforeSend = undefined;
    };
  }, [ready]);
}
