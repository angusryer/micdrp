/**
 * errorMessage — a human-readable string from an unknown thrown value.
 *
 * Screens catch errors as `unknown` (the shared `AppError` is thrown as a real
 * Error carrying a `.message`). This is the single helper they use to render a
 * caught value, so the "what do we show the user?" rule lives in one place.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

export default errorMessage;
