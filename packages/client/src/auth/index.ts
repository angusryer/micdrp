/**
 * Auth barrel — the public surface of the auth feature. `providers.tsx` and the
 * navigator import from here; never reach into `AuthContext` directly.
 */
export { AuthProvider, useAuth } from './AuthContext';
export type { AuthContextValue } from './AuthContext';
