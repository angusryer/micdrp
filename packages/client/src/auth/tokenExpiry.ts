/**
 * When an access token stops being accepted, read from the token itself.
 *
 * The client never restates the backend's token lifetime (Axiom 2): the
 * backend writes `exp` into every token it issues, so that is the number
 * renewal is timed against.
 */

function expirySeconds(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) {
    return null;
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const { exp } = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Whether `token` expires within `seconds` of now.
 *
 * A token that cannot be read is not called expiring: the backend issues
 * nothing else, so an unreadable one is for the backend to judge rather than
 * a reason to spend the refresh token.
 */
export function expiresWithin(
  token: string,
  seconds: number,
  nowMs: number = Date.now()
): boolean {
  const exp = expirySeconds(token);
  return exp != null && exp * 1000 - nowMs <= seconds * 1000;
}
