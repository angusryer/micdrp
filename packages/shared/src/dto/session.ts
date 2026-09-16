/**
 * The session routes the backend's hooks serve (INV-ACCOUNT-016..023).
 *
 * Shared so the client and the test that reads backend/pb_hooks agree on one
 * spelling: a route spelled two ways is a refresh that 404s, and a 404 reads
 * as "unreachable", which keeps the singer signed in until the access token
 * runs out and then asks for the password — the failure this exists to end.
 */
export const SESSION_ROUTES = {
  refresh: '/api/micdrp/session/refresh',
  adopt: '/api/micdrp/session/adopt',
  signOut: '/api/micdrp/session/sign-out'
} as const;

/** What a sign-in or a refresh carries beside the access token. */
export interface SessionMetaDto {
  refreshToken?: string;
}
